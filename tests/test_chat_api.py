"""Tests for the Chat sessions and one-shot execution API."""
from app.api import chat_routes
from app.services import chat_orchestrator

# `client` is the operator-authenticated fixture from conftest.


def _seed_messages(session_id: str, count: int, start: int = 1) -> None:
    """Write `count` messages straight to the database, bypassing the agent."""
    from app.database import SessionLocal
    from app.models.chat import ChatMessage, ChatRole

    db = SessionLocal()
    try:
        for i in range(start, start + count):
            db.add(
                ChatMessage(
                    session_id=session_id,
                    sequence=i,
                    role=ChatRole.USER if i % 2 else ChatRole.ASSISTANT,
                    content=f"msg-{i}",
                )
            )
        db.commit()
    finally:
        db.close()


def test_create_and_get_chat_session(client):
    create_res = client.post(
        "/api/v1/chat/sessions",
        json={"title": "Test Chat Session", "agent_id": "test-designer"},
    )
    assert create_res.status_code == 201
    session = create_res.json()
    assert session["title"] == "Test Chat Session"
    assert session["agent_id"] == "test-designer"
    session_id = session["id"]

    get_res = client.get(f"/api/v1/chat/sessions/{session_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == session_id

    list_res = client.get("/api/v1/chat/sessions")
    assert list_res.status_code == 200
    assert session_id in [s["id"] for s in list_res.json()]

    del_res = client.delete(f"/api/v1/chat/sessions/{session_id}")
    assert del_res.status_code == 200
    assert client.get(f"/api/v1/chat/sessions/{session_id}").status_code == 404


def test_one_shot_execution(client):
    res = client.post(
        "/api/v1/chat/execute",
        json={"content": "Hello test agent", "agent_id": "test-designer", "engine": "mock"},
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")


def test_messages_are_persisted_and_replayed_as_history(client):
    """A chat has to be a conversation, not a series of unrelated one-shots."""
    session_id = client.post(
        "/api/v1/chat/sessions", json={"title": "New Chat"}
    ).json()["id"]

    first = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages",
        json={"content": "My favourite colour is teal.", "engine": "mock"},
    )
    assert first.status_code == 200
    first.read()  # drain the SSE stream so the assistant turn is persisted

    session = client.get(f"/api/v1/chat/sessions/{session_id}").json()
    roles = [m["role"] for m in session["messages"]]
    assert roles == ["user", "assistant"], session["messages"]
    # The session took its title from the first thing the user said.
    assert session["title"].startswith("My favourite colour")

    # Sequences are contiguous, so the transcript cannot interleave.
    assert [m["sequence"] for m in session["messages"]] == [1, 2]

    second = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages",
        json={"content": "What is it?", "engine": "mock"},
    )
    second.read()
    session = client.get(f"/api/v1/chat/sessions/{session_id}").json()
    assert [m["sequence"] for m in session["messages"]] == [1, 2, 3, 4]

    client.delete(f"/api/v1/chat/sessions/{session_id}")


def test_history_is_rendered_oldest_first_and_bounded():
    turns = [
        chat_orchestrator.HistoryTurn(role="user", content="first"),
        chat_orchestrator.HistoryTurn(role="assistant", content="second"),
        chat_orchestrator.HistoryTurn(role="user", content="third"),
    ]
    rendered = chat_orchestrator._render_history(turns)
    assert rendered.index("first") < rendered.index("second") < rendered.index("third")
    assert "User: first" in rendered
    assert "Assistant: second" in rendered

    assert chat_orchestrator._render_history([]) == ""


def test_history_truncation_never_leaves_a_hole(monkeypatch):
    """A gap mid-conversation reads as though those exchanges never happened."""
    monkeypatch.setattr(chat_orchestrator, "MAX_HISTORY_CHARS", 120)

    turns = [
        chat_orchestrator.HistoryTurn(role="user", content="oldest and short"),
        chat_orchestrator.HistoryTurn(role="assistant", content="B" * 400),
        chat_orchestrator.HistoryTurn(role="user", content="newest and short"),
    ]
    rendered = chat_orchestrator._render_history(turns)

    # The newest turn fits and survives; the oversized one stops the walk, so
    # the short turn *older* than it must not be smuggled back in.
    assert "newest and short" in rendered
    assert "oldest and short" not in rendered
    assert "BBBB" not in rendered
    assert "2 earlier turn(s) omitted" in rendered


def _granted(cmd):
    """Permission patterns actually handed to the CLI, in either flag form."""
    granted = set()
    for index, part in enumerate(cmd):
        if part == "--allow-tool":
            granted.add(cmd[index + 1])
        elif part.startswith("--allow-tool="):
            granted.add(part.split("=", 1)[1])
    return granted


def test_chat_grants_the_cli_no_write_shell_or_fetch(tmp_path):
    """Chat reads the hub; it never writes to it.

    Nothing is granted at all now, which is stronger than before rather than
    weaker: `--allow-tool read` was never a permission pattern the CLI
    understood (the kinds are shell(...), write(...), url(...) and
    <mcp-server>(...)), so it was accepted and discarded. Reading is not gated,
    so the correct grant for a read-only turn is the empty one.
    """
    config = chat_orchestrator.ChatConfig(content="hi", agent_id="test-designer")
    cmd = chat_orchestrator._build_copilot_cmd(
        config, "prompt", work=tmp_path, model=None
    )
    assert "--allow-all" not in cmd
    assert "--allow-all-tools" not in cmd
    granted = _granted(cmd)
    assert granted == set(), granted
    assert not any(part.startswith("--allow-tool") for part in cmd)

    bare = chat_orchestrator._build_copilot_cmd(
        chat_orchestrator.ChatConfig(content="hi"), "prompt", work=tmp_path, model=None
    )
    assert _granted(bare) == set()


def test_an_agent_declaring_write_is_still_not_granted_it_in_chat(tmp_path):
    """The agent definitions all declare `write` for their job runs. A chat turn
    must not inherit that: hub writes are an author action in the Registry."""
    config = chat_orchestrator.ChatConfig(content="hi", agent_id="test-generator")
    cmd = chat_orchestrator._build_copilot_cmd(
        config, "prompt", work=tmp_path, model=None
    )
    assert "write" not in _granted(cmd)


def test_the_hub_is_staged_where_the_cli_discovers_agents(tmp_path):
    """The console bug: chat ran in an empty temp dir, so the CLI could see no
    agents at all and every turn died on `No such agent: …, available:`."""
    chat_orchestrator._stage_hub_context(tmp_path)
    assert (tmp_path / ".github" / "agents" / "test-designer.agent.md").is_file()
    assert (tmp_path / ".github" / "skills" / "test-case-generation").is_dir()


def test_staged_agents_are_real_files_not_links_into_the_host_tree(tmp_path):
    """agent-hub/.github/{agents,skills} are symlinks. Copied as links they
    would point at a path that does not exist inside a container."""
    chat_orchestrator._stage_hub_context(tmp_path)
    staged = tmp_path / ".github" / "agents"
    assert not staged.is_symlink()
    assert not (staged / "test-designer.agent.md").is_symlink()


def test_a_skill_selection_resolves_to_its_hub_directory(tmp_path):
    config = chat_orchestrator.ChatConfig(content="hi", skill_id="document-ocr")
    cmd = chat_orchestrator._build_copilot_cmd(
        config, "prompt", work=tmp_path, model=None
    )
    assert "--skill-path" in cmd
    assert cmd[cmd.index("--skill-path") + 1].endswith("/skills/document-ocr")


def test_a_traversing_skill_id_never_becomes_a_path(tmp_path):
    for hostile in ("../../etc", "..", "skills/../../..", ""):
        cmd = chat_orchestrator._build_copilot_cmd(
            chat_orchestrator.ChatConfig(content="hi", skill_id=hostile),
            "prompt",
            work=tmp_path,
            model=None,
        )
        assert "--skill-path" not in cmd, hostile


def test_an_unknown_agent_is_explained_not_forwarded_to_the_cli():
    """A bad name should name the Registry, not leak a raw CLI failure."""
    import asyncio

    config = chat_orchestrator.ChatConfig(
        content="hi", agent_id="no-such-agent", engine="copilot"
    )

    async def collect() -> str:
        return "".join([c async for c in chat_orchestrator.execute_streaming(config)])

    out = asyncio.run(collect())
    assert "no-such-agent" in out
    assert "Registry" in out


def test_chat_session_is_owned_by_the_caller(client):
    session = client.post(
        "/api/v1/chat/sessions",
        json={"title": "Owned", "agent_id": "test-designer"},
    ).json()
    assert session["created_by"] == "test-operator"
    client.delete(f"/api/v1/chat/sessions/{session['id']}")


def test_get_session_returns_the_last_n_messages(client):
    """Opening a session must not hydrate an unbounded transcript."""
    session_id = client.post(
        "/api/v1/chat/sessions", json={"title": "Long transcript"}
    ).json()["id"]
    _seed_messages(session_id, 11)

    capped = client.get(f"/api/v1/chat/sessions/{session_id}?message_limit=5").json()
    assert [m["sequence"] for m in capped["messages"]] == [7, 8, 9, 10, 11]
    assert [m["content"] for m in capped["messages"]] == [
        "msg-7",
        "msg-8",
        "msg-9",
        "msg-10",
        "msg-11",
    ]

    defaulted = client.get(f"/api/v1/chat/sessions/{session_id}").json()
    assert len(defaulted["messages"]) == 11

    client.delete(f"/api/v1/chat/sessions/{session_id}")


def test_a_bounded_window_reports_the_real_total(client):
    """The console cannot say "showing the last N of M" without M."""
    session_id = client.post(
        "/api/v1/chat/sessions", json={"title": "Totals"}
    ).json()["id"]
    _seed_messages(session_id, 11)

    capped = client.get(f"/api/v1/chat/sessions/{session_id}?message_limit=4").json()
    assert len(capped["messages"]) == 4
    assert capped["message_total"] == 11

    client.delete(f"/api/v1/chat/sessions/{session_id}")


def test_messages_page_backwards_from_a_sequence(client):
    """"Load earlier" has to reach messages the first window left behind."""
    session_id = client.post(
        "/api/v1/chat/sessions", json={"title": "Paging"}
    ).json()["id"]
    _seed_messages(session_id, 11)

    tail = client.get(f"/api/v1/chat/sessions/{session_id}?message_limit=4").json()
    oldest_on_screen = tail["messages"][0]["sequence"]
    assert oldest_on_screen == 8

    earlier = client.get(
        f"/api/v1/chat/sessions/{session_id}"
        f"?message_limit=4&before_sequence={oldest_on_screen}"
    ).json()
    assert [m["sequence"] for m in earlier["messages"]] == [4, 5, 6, 7]
    assert earlier["message_total"] == 11

    client.delete(f"/api/v1/chat/sessions/{session_id}")


def test_sessions_page_with_offset(client):
    """Without an offset every session past the first page is unreachable."""
    ids = [
        client.post("/api/v1/chat/sessions", json={"title": f"Paged {i}"}).json()["id"]
        for i in range(3)
    ]
    try:
        first = client.get("/api/v1/chat/sessions?limit=1").json()
        second = client.get("/api/v1/chat/sessions?limit=1&offset=1").json()
        assert len(first) == 1 and len(second) == 1
        assert first[0]["id"] != second[0]["id"]
    finally:
        for session_id in ids:
            client.delete(f"/api/v1/chat/sessions/{session_id}")


def test_a_taken_sequence_is_retried_rather_than_failing(client, monkeypatch):
    """Two turns racing for one sequence must not surface as a 500."""
    session_id = client.post(
        "/api/v1/chat/sessions", json={"title": "Racing"}
    ).json()["id"]
    _seed_messages(session_id, 1)

    real_next_sequence = chat_routes._next_sequence
    calls = {"count": 0}

    def stale_once(db, sid):
        calls["count"] += 1
        # Hand back a sequence another writer already claimed, exactly as a
        # concurrent turn would after both read the same maximum.
        if calls["count"] == 1:
            return 1
        return real_next_sequence(db, sid)

    monkeypatch.setattr(chat_routes, "_next_sequence", stale_once)

    res = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages",
        json={"content": "after the collision", "engine": "mock"},
    )
    assert res.status_code == 200
    res.read()

    # Guards the test itself: without a second attempt nothing was retried and
    # the assertions below would pass for the wrong reason.
    assert calls["count"] >= 2, calls

    session = client.get(f"/api/v1/chat/sessions/{session_id}").json()
    sequences = [m["sequence"] for m in session["messages"]]
    assert sequences == sorted(set(sequences)), sequences
    assert "after the collision" in [m["content"] for m in session["messages"]]

    client.delete(f"/api/v1/chat/sessions/{session_id}")


def test_a_finished_turn_frees_its_concurrency_slot(client):
    """The per-caller registry must not keep an entry for every name forever."""
    session_id = client.post(
        "/api/v1/chat/sessions", json={"title": "Slots"}
    ).json()["id"]

    client.post(
        f"/api/v1/chat/sessions/{session_id}/messages",
        json={"content": "hello", "engine": "mock"},
    ).read()

    assert chat_routes._user_chat_slots == {}
    client.delete(f"/api/v1/chat/sessions/{session_id}")


def test_an_oversized_message_is_rejected(client):
    """The limit is configuration, so it has to actually reach validation."""
    from app.schemas.chat import MAX_MESSAGE_CHARS

    session_id = client.post(
        "/api/v1/chat/sessions", json={"title": "Too long"}
    ).json()["id"]

    res = client.post(
        f"/api/v1/chat/sessions/{session_id}/messages",
        json={"content": "x" * (MAX_MESSAGE_CHARS + 1), "engine": "mock"},
    )
    assert res.status_code == 422

    client.delete(f"/api/v1/chat/sessions/{session_id}")


# ------------------------------------------------- the console's retry decisions


def _drive(config, monkeypatch, attempts):
    """Run execute_streaming against a scripted sequence of CLI attempts.

    Each entry in `attempts` is (chunks_to_emit, failure_message).
    """
    import asyncio

    from app.services import chat_orchestrator as chat

    seen = []

    async def fake_stream_once(cmd, env, cwd, state, deadline):
        chunks, failure = attempts[min(len(seen), len(attempts) - 1)]
        seen.append(cmd)
        for chunk in chunks:
            state.emitted = True
            yield chunk
        state.failure = failure

    monkeypatch.setattr(chat, "_stream_once", fake_stream_once)
    monkeypatch.setattr(chat, "_stage_hub_context", lambda work: None)
    monkeypatch.setattr(asyncio, "sleep", _no_sleep)

    async def collect():
        return [c async for c in chat.execute_streaming(config)]

    return "".join(asyncio.run(collect())), seen


async def _no_sleep(_seconds):
    return None


def test_a_model_the_account_rejects_is_dropped_and_the_turn_still_answers(monkeypatch):
    """This is what the console showed as a 2.2s failure: the turn died on a
    model the account cannot use, instead of asking for the default."""
    from app.services import chat_orchestrator as chat
    from app.services import runner_bridge

    runner_bridge.copilot_cli().reset_model_fallback()
    config = chat.ChatConfig(
        content="hi", agent_id="test-designer", model="gpt-4o", engine="copilot"
    )

    text, seen = _drive(
        config,
        monkeypatch,
        [
            ([], "The requested model from --model flag is not available"),
            (["the answer"], ""),
        ],
    )

    assert text == "the answer"
    assert "--model" in seen[0]
    assert "--model" not in seen[1], "the rejected model must not be sent again"
    runner_bridge.copilot_cli().reset_model_fallback()


def test_a_transient_failure_is_retried(monkeypatch):
    from app.services import chat_orchestrator as chat

    config = chat.ChatConfig(content="hi", agent_id="test-designer", engine="copilot")
    text, seen = _drive(
        config, monkeypatch, [([], "503 Service Unavailable"), (["recovered"], "")]
    )
    assert text == "recovered"
    assert len(seen) == 2


def test_an_authentication_failure_is_reported_immediately(monkeypatch):
    """No retry produces a token, and three attempts at it just wastes the wait."""
    from app.services import chat_orchestrator as chat

    config = chat.ChatConfig(content="hi", agent_id="test-designer", engine="copilot")
    text, seen = _drive(config, monkeypatch, [([], "Error: Authentication failed")])
    assert len(seen) == 1
    assert "authentication" in text.lower()


def test_a_partial_answer_is_never_followed_by_a_second_attempt(monkeypatch):
    """Appending a retry to text the user has already read produces nonsense."""
    from app.services import chat_orchestrator as chat

    config = chat.ChatConfig(content="hi", agent_id="test-designer", engine="copilot")
    text, seen = _drive(
        config, monkeypatch, [(["half an answer"], "503 Service Unavailable")]
    )
    assert len(seen) == 1
    assert text.startswith("half an answer")


def test_an_unknown_agent_names_the_ones_that_do_exist(monkeypatch):
    import asyncio

    from app.services import chat_orchestrator as chat

    config = chat.ChatConfig(
        content="hi", agent_id="not-a-real-agent", engine="copilot"
    )

    async def collect():
        return [c async for c in chat.execute_streaming(config)]

    text = "".join(asyncio.run(collect()))
    assert "not-a-real-agent" in text
    assert "test-designer" in text, "the reply should say what is available"


# --------------------------------------------------- console prompt framing

def test_an_artifact_agent_is_told_its_reply_is_the_artifact():
    """The console cannot give an agent the file its own prompt demands.

    `test-designer.agent.md` says "write JSON only, no fences, to
    intermediate/test_design.json". Chat strips `write` and has no workspace, so
    without reframing the agent satisfies both readings at once: the payload
    bare, then a narrated copy inside a fence. That doubled output is the bug
    this framing exists to prevent.
    """
    from app.services.chat_orchestrator import ChatConfig, _resolve_prompt_content

    prompt = _resolve_prompt_content(
        ChatConfig(content="Export a test run to Excel.", agent_id="test-designer")
    )

    assert "intermediate/test_design.json" in prompt
    assert "never repeat the content a second time" in prompt
    # The framing leads, so the user's text stays last and stays data.
    assert prompt.index("HOW TO REPLY") < prompt.index("Export a test run")


def test_a_conversational_agent_gets_no_artifact_framing():
    """An agent that declares no artifact has no contradiction to resolve."""
    from app.services.chat_orchestrator import ChatConfig, _resolve_prompt_content

    assert _resolve_prompt_content(ChatConfig(content="hello")) == "hello"


def test_framing_survives_an_unknown_agent():
    """A stale agent id must not break prompt construction."""
    from app.services.chat_orchestrator import ChatConfig, _resolve_prompt_content

    prompt = _resolve_prompt_content(
        ChatConfig(content="hi", agent_id="zz-not-onboarded")
    )
    assert prompt == "hi"


def test_mock_contract_reply_matches_the_agents_declared_shape():
    """Mock mode must answer in the shape the real agent would.

    `ENGINE=mock` is what CI and every first run use. When the designer replied
    with a hand-written Markdown table while the real agent returned schema-valid
    JSON, the entire structured path — the console's Structured view,
    `extractJson`, every downstream consumer — was untested in the one mode that
    always runs.
    """
    import json

    from app.services.chat_orchestrator import _mock_contract_reply

    for agent_id in ("test-designer", "test-generator", "test-evaluator"):
        reply = _mock_contract_reply(agent_id)
        assert reply is not None, f"{agent_id} declares a schema but mocks prose"
        body = reply.strip().removeprefix("```json").removesuffix("```").strip()
        json.loads(body)  # raises if the canned document is not valid JSON


def test_an_agent_without_a_contract_still_mocks_prose():
    """Inventing JSON for a prose agent would be its own kind of wrong."""
    from app.services.chat_orchestrator import _mock_contract_reply

    assert _mock_contract_reply("ocr-extractor") is None
    assert _mock_contract_reply(None) is None
    assert _mock_contract_reply("zz-not-onboarded") is None
