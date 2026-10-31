import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
export const db = new Database('data/previously-on.db');
db.exec(`CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY CHECK (id=1), user_id TEXT NOT NULL, login TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, scopes TEXT NOT NULL, expires_at INTEGER NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS stream_sessions (id INTEGER PRIMARY KEY, twitch_stream_id TEXT UNIQUE, started_at TEXT NOT NULL, ended_at TEXT, is_crossover INTEGER NOT NULL DEFAULT 0, partner_json TEXT);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, session_id INTEGER, twitch_message_id TEXT NOT NULL UNIQUE, type TEXT NOT NULL, at TEXT NOT NULL, user_id TEXT, user_name TEXT, text TEXT, emotes_json TEXT NOT NULL, source_broadcaster_id TEXT, meta_json TEXT NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS moments (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, started_at TEXT NOT NULL, peak_at TEXT NOT NULL, score REAL NOT NULL, reason TEXT NOT NULL, top_emotes_json TEXT NOT NULL, sample_messages_json TEXT NOT NULL, credit_user TEXT, credit_kind TEXT, trigger TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'detected')`);
db.exec(`CREATE TABLE IF NOT EXISTS clips (id INTEGER PRIMARY KEY, moment_id INTEGER NOT NULL, twitch_clip_id TEXT UNIQUE, url TEXT, thumbnail_url TEXT, duration REAL, created_at TEXT, requested_at TEXT, video_id TEXT, vod_offset INTEGER, local_path TEXT, source TEXT NOT NULL, status TEXT NOT NULL)`);
export interface Token { user_id: string; login: string; access_token: string; refresh_token: string; scopes: string; expires_at: number }
export function getToken(): Token | undefined { return db.prepare('SELECT user_id, login, access_token, refresh_token, scopes, expires_at FROM tokens WHERE id=1').get() as Token | undefined; }
export function saveToken(t: Token): void { db.prepare('INSERT OR REPLACE INTO tokens VALUES (1,@user_id,@login,@access_token,@refresh_token,@scopes,@expires_at)').run(t); }
export function clearToken(): void { db.prepare('DELETE FROM tokens WHERE id=1').run(); }
