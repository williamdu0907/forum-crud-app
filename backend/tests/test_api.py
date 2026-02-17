import importlib
import sys

import pytest


def get_topics(client):
    resp = client.get("/api/topics")
    assert resp.status_code == 200
    return resp.get_json()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("SECRET_KEY", "test-secret")

    sys.modules.pop("backend.server", None)
    server = importlib.import_module("backend.server")
    server.app.config.update(TESTING=True)
    return server.app.test_client()


def test_topics_list(client):
    topics = get_topics(client)
    slugs = {t["slug"] for t in topics}
    assert "general" in slugs


def test_signup_login_me_logout(client):
    resp = client.post(
        "/api/signup",
        json={"username": "alice", "password": "pw", "displayName": "Alice"},
    )
    assert resp.status_code == 201
    assert resp.get_json() == {"username": "alice", "displayName": "Alice"}

    resp = client.get("/api/me")
    assert resp.status_code == 200
    assert resp.get_json() == {"username": "alice", "displayName": "Alice"}

    resp = client.post("/api/logout")
    assert resp.status_code == 204

    resp = client.get("/api/me")
    assert resp.status_code == 401


def test_comments_flow_requires_login(client):
    resp = client.post("/api/comments", json={"text": "Hello", "topic": "general"})
    assert resp.status_code == 401

    resp = client.post(
        "/api/signup",
        json={"username": "bob", "password": "pw"},
    )
    assert resp.status_code == 201

    topics = get_topics(client)
    topic = topics[0]["slug"]

    resp = client.post("/api/comments", json={"text": "Hello", "topic": topic})
    assert resp.status_code == 200
    comment = resp.get_json()
    assert comment["text"] == "Hello"
    assert comment["author"] == "bob"
    assert comment["score"] == 0
    assert comment["topic"]["slug"] == topic

    resp = client.get("/api/comments")
    assert resp.status_code == 200
    comments = resp.get_json()
    assert len(comments) == 1
    assert comments[0]["id"] == comment["id"]


def test_rating_updates_score(client):
    resp = client.post(
        "/api/signup",
        json={"username": "cora", "password": "pw"},
    )
    assert resp.status_code == 201

    topic = get_topics(client)[0]["slug"]
    resp = client.post("/api/comments", json={"text": "Rate me", "topic": topic})
    comment = resp.get_json()

    resp = client.post(f"/api/comments/{comment['id']}/rate", json={"delta": 1})
    assert resp.status_code == 200
    assert resp.get_json()["score"] == 1

    resp = client.post(f"/api/comments/{comment['id']}/rate", json={"delta": -1})
    assert resp.status_code == 200
    assert resp.get_json()["score"] == -1


def test_topic_filtering(client):
    resp = client.post(
        "/api/signup",
        json={"username": "dana", "password": "pw"},
    )
    assert resp.status_code == 201

    topics = get_topics(client)
    assert len(topics) >= 2
    topic_a = topics[0]["slug"]
    topic_b = topics[1]["slug"]

    resp = client.post("/api/comments", json={"text": "A1", "topic": topic_a})
    comment_a = resp.get_json()
    resp = client.post("/api/comments", json={"text": "B1", "topic": topic_b})
    comment_b = resp.get_json()

    resp = client.get(f"/api/comments?topic={topic_a}")
    assert resp.status_code == 200
    comments = resp.get_json()
    assert len(comments) == 1
    assert comments[0]["id"] == comment_a["id"]
    assert comments[0]["topic"]["slug"] == topic_a

    resp = client.get(f"/api/comments?topic={topic_b}")
    assert resp.status_code == 200
    comments = resp.get_json()
    assert len(comments) == 1
    assert comments[0]["id"] == comment_b["id"]
    assert comments[0]["topic"]["slug"] == topic_b
