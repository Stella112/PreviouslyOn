import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
export const db = new Database('data/previously-on.db');
db.exec(`CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY CHECK (id=1), user_id TEXT NOT NULL, login TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, scopes TEXT NOT NULL, expires_at INTEGER NOT NULL)`);
export interface Token { user_id: string; login: string; access_token: string; refresh_token: string; scopes: string; expires_at: number }
export function getToken(): Token | undefined { return db.prepare('SELECT user_id, login, access_token, refresh_token, scopes, expires_at FROM tokens WHERE id=1').get() as Token | undefined; }
export function saveToken(t: Token): void { db.prepare('INSERT OR REPLACE INTO tokens VALUES (1,@user_id,@login,@access_token,@refresh_token,@scopes,@expires_at)').run(t); }
export function clearToken(): void { db.prepare('DELETE FROM tokens WHERE id=1').run(); }
