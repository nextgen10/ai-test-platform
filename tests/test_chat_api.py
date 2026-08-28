"""Tests for the Chat sessions and one-shot execution API."""
from app.services import chat_orchestrator

# `client` is the operator-authenticated fixture from conftest.


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


def test_chat_session_is_owned_by_the_caller(client):
    session = client.post(
        "/api/v1/chat/sessions",
        json={"title": "Owned", "agent_id": "test-designer"},
    ).json()
    assert session["created_by"] == "test-operator"
    client.delete(f"/api/v1/chat/sessions/{session['id']}")
