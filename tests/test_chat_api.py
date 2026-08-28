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


def test_agent_tool_grant_comes_from_the_agent_definition():
    """The CLI must never be handed --allow-all, shell, fetch, or write."""
    config = chat_orchestrator.ChatConfig(content="hi", agent_id="test-designer")
    cmd = chat_orchestrator._build_copilot_cmd(config, "prompt")
    assert "--allow-all" not in cmd
    assert "--allow-tool" in cmd
    granted = {cmd[i + 1] for i, part in enumerate(cmd) if part == "--allow-tool"}
    assert granted == {"read"}
    assert "write" not in granted
    assert "shell" not in granted
    assert "fetch" not in granted

    # No agent selected means no tools beyond reading.
    bare = chat_orchestrator._build_copilot_cmd(
        chat_orchestrator.ChatConfig(content="hi"), "prompt"
    )
    assert {bare[i + 1] for i, p in enumerate(bare) if p == "--allow-tool"} == {"read"}


def test_a_skill_selection_resolves_to_its_hub_directory():
    config = chat_orchestrator.ChatConfig(content="hi", skill_id="document-ocr")
    cmd = chat_orchestrator._build_copilot_cmd(config, "prompt")
    assert "--skill-path" in cmd
    assert cmd[cmd.index("--skill-path") + 1].endswith("/skills/document-ocr")


def test_a_traversing_skill_id_never_becomes_a_path():
    for hostile in ("../../etc", "..", "skills/../../..", ""):
        cmd = chat_orchestrator._build_copilot_cmd(
            chat_orchestrator.ChatConfig(content="hi", skill_id=hostile), "prompt"
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
