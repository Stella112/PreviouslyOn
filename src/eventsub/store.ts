import { db } from '../db.js';
import type { NormalizedEvent } from './messages.js';
export function startSession(id:string, startedAt:string): void {
 db.prepare('UPDATE stream_sessions SET ended_at=? WHERE ended_at IS NULL AND twitch_stream_id != ?').run(startedAt,id);
 db.prepare('INSERT OR IGNORE INTO stream_sessions (twitch_stream_id,started_at) VALUES (?,?)').run(id,startedAt);
}
export function endSession(at:string): void { db.prepare('UPDATE stream_sessions SET ended_at=? WHERE ended_at IS NULL').run(at); }
export function recordEvent(e:NormalizedEvent): boolean {
 if (e.simulated) return true;
 if (e.type === 'stream.online' && typeof e.data.id === 'string' && typeof e.data.started_at === 'string') startSession(e.data.id,e.data.started_at);
 const session = db.prepare('SELECT id FROM stream_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get() as {id:number} | undefined;
 const result=db.prepare('INSERT OR IGNORE INTO events (session_id,twitch_message_id,type,at,user_id,user_name,text,emotes_json,source_broadcaster_id,meta_json) VALUES (?,?,?,?,?,?,?,?,?,?)').run(session?.id ?? null,e.id,e.type,e.at,e.userId ?? null,e.userName ?? null,e.text ?? null,JSON.stringify(e.emotes),e.sourceBroadcasterId ?? null,JSON.stringify(e.data));
 if (e.type === 'stream.offline') endSession(e.at);
 return result.changes > 0;
}
