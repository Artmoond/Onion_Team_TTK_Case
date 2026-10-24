"""SQLite-хранилище пользователей и refresh-токенов.

SQLite выбран осознанно: он не требует отдельного контейнера, переживает
перезапуск бэкенда и закрывает потребности хакатонного демо. Схема и доступ
организованы так, чтобы позже безболезненно переехать на PostgreSQL.
"""
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

from . import config
from .security import hash_password, utcnow_iso

# Один процесс FastAPI, несколько потоков — создаём отдельное соединение на
# каждую операцию. WAL позволяет читать во время записи.
_init_lock = threading.Lock()
_initialized = False


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(config.AUTH_DB_PATH), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 15000")
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL COLLATE NOCASE UNIQUE,
    full_name       TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    is_active       INTEGER NOT NULL DEFAULT 1,
    token_version   INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    last_login_at   TEXT
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    jti         TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    revoked_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    email      TEXT,
    event      TEXT NOT NULL,
    ip         TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at);
"""


def init_db() -> None:
    global _initialized
    with _init_lock:
        if _initialized:
            return
        config.AUTH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with db() as conn:
            conn.executescript(SCHEMA)
            conn.execute("PRAGMA journal_mode = WAL")
        _seed_demo_users()
        try:
            # База не должна читаться другими пользователями хоста.
            config.AUTH_DB_PATH.chmod(0o600)
        except OSError:
            pass
        _initialized = True


def _seed_demo_users() -> None:
    if not config.SEED_DEMO_USERS:
        return

    demo_accounts = [
        (config.SEED_ADMIN_EMAIL, config.SEED_ADMIN_PASSWORD, "Администратор ТТК", "admin"),
        (config.SEED_USER_EMAIL, config.SEED_USER_PASSWORD, "Гость Экспоцентра", "user"),
    ]
    created: list[str] = []
    with db() as conn:
        for email, password, full_name, role in demo_accounts:
            if not email or not password:
                continue
            existing = conn.execute(
                "SELECT id FROM users WHERE email = ?", (email,)
            ).fetchone()
            if existing:
                continue
            now = utcnow_iso()
            conn.execute(
                """
                INSERT INTO users (id, email, full_name, password_hash, role,
                                   is_active, token_version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    email.strip().lower(),
                    full_name,
                    hash_password(password),
                    role,
                    now,
                    now,
                ),
            )
            created.append(f"{role}: {email}")

    if created:
        print("[auth] Созданы демо-аккаунты: " + ", ".join(created))
        print("[auth] Смените пароли через TTK_ADMIN_PASSWORD / TTK_USER_PASSWORD.")


def row_to_user(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "email": row["email"],
        "fullName": row["full_name"],
        "role": row["role"],
        "isActive": bool(row["is_active"]),
        "createdAt": row["created_at"],
        "lastLoginAt": row["last_login_at"],
    }


def get_user_by_email(email: str) -> Optional[sqlite3.Row]:
    with db() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
        ).fetchone()


def get_user_by_id(user_id: str) -> Optional[sqlite3.Row]:
    with db() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def create_user(
    *, email: str, full_name: str, password: str, role: str
) -> sqlite3.Row:
    now = utcnow_iso()
    user_id = str(uuid.uuid4())
    with db() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, full_name, password_hash, role,
                               is_active, token_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
            """,
            (
                user_id,
                email.strip().lower(),
                full_name.strip(),
                hash_password(password),
                role,
                now,
                now,
            ),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    assert row is not None
    return row


def update_login_success(user_id: str) -> None:
    now = utcnow_iso()
    with db() as conn:
        conn.execute(
            """
            UPDATE users
               SET failed_attempts = 0,
                   locked_until = NULL,
                   last_login_at = ?,
                   updated_at = ?
             WHERE id = ?
            """,
            (now, now, user_id),
        )


def register_failed_attempt(user_id: str, max_attempts: int, lock_seconds: int) -> None:
    from datetime import timedelta

    from .security import utcnow

    now = utcnow()
    with db() as conn:
        row = conn.execute(
            "SELECT failed_attempts FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not row:
            return
        attempts = int(row["failed_attempts"]) + 1
        locked_until = None
        if attempts >= max_attempts:
            locked_until = (now + timedelta(seconds=lock_seconds)).isoformat(timespec="seconds")
            attempts = 0
        conn.execute(
            """
            UPDATE users
               SET failed_attempts = ?, locked_until = ?, updated_at = ?
             WHERE id = ?
            """,
            (attempts, locked_until, now.isoformat(timespec="seconds"), user_id),
        )


def set_password(user_id: str, password: str) -> None:
    now = utcnow_iso()
    with db() as conn:
        conn.execute(
            """
            UPDATE users
               SET password_hash = ?, updated_at = ?,
                   failed_attempts = 0, locked_until = NULL
             WHERE id = ?
            """,
            (hash_password(password), now, user_id),
        )


def bump_token_version(user_id: str) -> None:
    with db() as conn:
        conn.execute(
            """
            UPDATE users
               SET token_version = token_version + 1, updated_at = ?
             WHERE id = ?
            """,
            (utcnow_iso(), user_id),
        )


# --- REFRESH TOKENS -------------------------------------------------------

def store_refresh_token(jti: str, user_id: str, expires_at: str) -> None:
    with db() as conn:
        conn.execute(
            """
            INSERT INTO refresh_tokens (jti, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (jti, user_id, expires_at, utcnow_iso()),
        )


def get_refresh_token(jti: str) -> Optional[sqlite3.Row]:
    with db() as conn:
        return conn.execute(
            "SELECT * FROM refresh_tokens WHERE jti = ?", (jti,)
        ).fetchone()


def revoke_refresh_token(jti: str) -> bool:
    """Атомарно отзывает токен. False — он уже был отозван/не найден."""
    with db() as conn:
        cursor = conn.execute(
            """
            UPDATE refresh_tokens
               SET revoked_at = ?
             WHERE jti = ? AND revoked_at IS NULL
            """,
            (utcnow_iso(), jti),
        )
        return cursor.rowcount > 0


def revoke_all_refresh_tokens(user_id: str) -> None:
    with db() as conn:
        conn.execute(
            """
            UPDATE refresh_tokens
               SET revoked_at = ?
             WHERE user_id = ? AND revoked_at IS NULL
            """,
            (utcnow_iso(), user_id),
        )


def cleanup_expired_tokens() -> int:
    with db() as conn:
        cursor = conn.execute(
            "DELETE FROM refresh_tokens WHERE expires_at < ?", (utcnow_iso(),)
        )
        return cursor.rowcount


def log_auth_event(
    event: str,
    *,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    ip: Optional[str] = None,
) -> None:
    try:
        with db() as conn:
            conn.execute(
                """
                INSERT INTO auth_events (user_id, email, event, ip, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, email, event, ip, utcnow_iso()),
            )
    except sqlite3.Error:
        # Аудит не должен ломать основной сценарий входа.
        pass


init_db()
