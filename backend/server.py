import os
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from .database import get_db, init_db

FRONTEND_DIST = (Path(__file__).resolve().parent.parent / "dist").resolve()


def _cors_origins():
    env_val = os.getenv("CORS_ORIGINS")
    if env_val:
        return [o.strip() for o in env_val.split(",") if o.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


app = Flask(__name__, static_folder=str(FRONTEND_DIST), static_url_path="/")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-me")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
app.config["DEBUG"] = os.getenv("FLASK_DEBUG", "false").lower() == "true"

CORS(
    app,
    supports_credentials=True,
    origins=_cors_origins(),
)
init_db()


def _format_timestamp(value):
    if not value:
        return value
    return value if value.endswith("Z") else f"{value}Z"


def _topic_json(topic_row):
    if not topic_row:
        return None
    return {"slug": topic_row["slug"], "name": topic_row["name"]}


def current_user():
    username = session.get("user")
    if not username:
        return None
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, password_hash, display_name, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return user
    finally:
        conn.close()


def user_json(user):
    return {"username": user["username"], "displayName": user["display_name"]}


@app.get("/api/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"error": "Not logged in"}), 401
    return jsonify(user_json(user))


@app.get("/api/topics")
def list_topics():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT slug, name FROM topics ORDER BY name"
        ).fetchall()
        return jsonify([
            {"slug": row["slug"], "name": row["name"]} for row in rows
        ])
    finally:
        conn.close()


@app.post("/api/signup")
def signup():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    display = (data.get("displayName") or "").strip() or username

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT 1 FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if existing:
            return jsonify({"error": "Username already exists"}), 409

        user = {
            "id": str(uuid4()),
            "username": username,
            "password_hash": generate_password_hash(password),
            "display_name": display,
            "created_at": datetime.utcnow().isoformat(),
        }
        conn.execute(
            """
            INSERT INTO users (id, username, password_hash, display_name, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                user["username"],
                user["password_hash"],
                user["display_name"],
                user["created_at"],
            ),
        )
        conn.commit()
        session["user"] = username
        return jsonify(user_json(user)), 201
    finally:
        conn.close()


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, password_hash, display_name, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials"}), 401

        session["user"] = username
        return jsonify(user_json(user))
    finally:
        conn.close()


@app.post("/api/logout")
def logout():
    session.pop("user", None)
    return ("", 204)


@app.get("/api/comments")
def list_comments():
    topic = (request.args.get("topic") or "").strip()
    conn = get_db()
    try:
        query = (
            "SELECT c.id, c.text, c.author_name, c.score, c.created_at, c.topic_slug, "
            "t.name as topic_name "
            "FROM comments c "
            "LEFT JOIN topics t ON c.topic_slug = t.slug"
        )
        params = []
        if topic:
            query += " WHERE c.topic_slug = ?"
            params.append(topic)
        query += " ORDER BY c.created_at DESC"

        comments = conn.execute(query, params).fetchall()
        return jsonify(
            [
                {
                    "id": c["id"],
                    "text": c["text"],
                    "author": c["author_name"],
                    "score": c["score"],
                    "createdAt": _format_timestamp(c["created_at"]),
                    "topic": {
                        "slug": c["topic_slug"],
                        "name": c["topic_name"],
                    },
                }
                for c in comments
            ]
        )
    finally:
        conn.close()


@app.post("/api/comments")
def add_comment():
    user = current_user()
    if not user:
        return jsonify({"error": "Login required"}), 401

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    topic_slug = (data.get("topic") or "").strip()

    if not text:
        return jsonify({"error": "Comment text required"}), 400
    if not topic_slug:
        return jsonify({"error": "Topic is required"}), 400

    conn = get_db()
    try:
        topic_row = conn.execute(
            "SELECT slug, name FROM topics WHERE slug = ?",
            (topic_slug,),
        ).fetchone()
        if not topic_row:
            return jsonify({"error": "Invalid topic"}), 400

        comment = {
            "id": str(uuid4()),
            "text": text,
            "author_name": user["display_name"],
            "score": 0,
            "created_at": datetime.utcnow().isoformat(),
            "topic_slug": topic_slug,
        }
        conn.execute(
            """
            INSERT INTO comments (id, text, author_name, score, created_at, topic_slug)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                comment["id"],
                comment["text"],
                comment["author_name"],
                comment["score"],
                comment["created_at"],
                comment["topic_slug"],
            ),
        )
        conn.commit()
        return jsonify(
            {
                "id": comment["id"],
                "text": comment["text"],
                "author": comment["author_name"],
                "score": comment["score"],
                "createdAt": _format_timestamp(comment["created_at"]),
                "topic": _topic_json(topic_row),
            }
        )
    finally:
        conn.close()


@app.post("/api/comments/<comment_id>/rate")
def rate_comment(comment_id):
    user = current_user()
    if not user:
        return jsonify({"error": "Login required"}), 401

    data = request.get_json(silent=True) or {}
    delta = int(data.get("delta") or 0)
    if delta not in (1, -1):
        return jsonify({"error": "delta must be 1 or -1"}), 400

    conn = get_db()
    try:
        conn.execute("BEGIN")
        comment = conn.execute(
            "SELECT id, text, author_name, score, created_at, topic_slug FROM comments WHERE id = ?",
            (comment_id,),
        ).fetchone()
        if not comment:
            conn.execute("ROLLBACK")
            return jsonify({"error": "Comment not found"}), 404

        vote = conn.execute(
            "SELECT id, value FROM votes WHERE comment_id = ? AND username = ?",
            (comment_id, user["username"]),
        ).fetchone()
        previous = vote["value"] if vote else 0

        if vote and previous == delta:
            conn.execute(
                "DELETE FROM votes WHERE id = ?",
                (vote["id"],),
            )
            new_score = comment["score"] - previous
        else:
            if vote:
                conn.execute(
                    "UPDATE votes SET value = ? WHERE id = ?",
                    (delta, vote["id"]),
                )
            else:
                conn.execute(
                    "INSERT INTO votes (id, comment_id, username, value) VALUES (?, ?, ?, ?)",
                    (str(uuid4()), comment_id, user["username"], delta),
                )

            new_score = comment["score"] + (delta - previous)

        conn.execute(
            "UPDATE comments SET score = ? WHERE id = ?",
            (new_score, comment_id),
        )
        conn.commit()

        topic_row = conn.execute(
            "SELECT slug, name FROM topics WHERE slug = ?",
            (comment["topic_slug"],),
        ).fetchone()

        return jsonify(
            {
                "id": comment["id"],
                "text": comment["text"],
                "author": comment["author_name"],
                "score": new_score,
                "createdAt": _format_timestamp(comment["created_at"]),
                "topic": _topic_json(topic_row),
            }
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=app.config.get("DEBUG", False))


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if FRONTEND_DIST.exists():
        target = FRONTEND_DIST / path
        if path and target.exists():
            return send_from_directory(FRONTEND_DIST, path)
        index = FRONTEND_DIST / "index.html"
        if index.exists():
            return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"error": "Not Found"}), 404
