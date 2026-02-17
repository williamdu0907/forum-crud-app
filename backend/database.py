import os
import sqlite3
from pathlib import Path

DEFAULT_TOPICS = [
    {"slug": "general", "name": "General"},
    {"slug": "help", "name": "Help"},
    {"slug": "feedback", "name": "Feedback"},
    {"slug": "news", "name": "News"},
]


def _db_path():
    url = os.getenv("DATABASE_URL")
    if url:
        if url.startswith("sqlite:///"):
            return url.replace("sqlite:///", "", 1)
        if url.startswith("sqlite://"):
            return url.replace("sqlite://", "", 1)
        return url
    data_dir = Path(__file__).resolve().parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return str(data_dir / "app.db")


def get_db():
    conn = sqlite3.connect(_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_column(conn, table, column, definition):
    cols = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS topics (
                slug TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                author_name TEXT NOT NULL,
                score INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS votes (
                id TEXT PRIMARY KEY,
                comment_id TEXT NOT NULL,
                username TEXT NOT NULL,
                value INTEGER NOT NULL,
                UNIQUE(comment_id, username)
            );
            CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
            CREATE INDEX IF NOT EXISTS idx_votes_comment_id ON votes(comment_id);
            CREATE INDEX IF NOT EXISTS idx_votes_username ON votes(username);
            """
        )

        _ensure_column(conn, "comments", "topic_slug", "TEXT")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_comments_topic ON comments(topic_slug)"
        )
        conn.executemany(
            "INSERT OR IGNORE INTO topics (slug, name) VALUES (?, ?)",
            [(topic["slug"], topic["name"]) for topic in DEFAULT_TOPICS],
        )
        default_slug = DEFAULT_TOPICS[0]["slug"]
        conn.execute(
            "UPDATE comments SET topic_slug = ? WHERE topic_slug IS NULL OR topic_slug = ''",
            (default_slug,),
        )
