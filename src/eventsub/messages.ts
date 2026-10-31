export interface Envelope { metadata: { message_id: string; message_type: string; message_timestamp: string; subscription_type?: string }; payload: { session?: {id: string; keepalive_timeout_seconds: number; reconnect_url?: string}; subscription?: {type: string; status: string}; event?: Record<string, unknown> } }
export interface NormalizedEvent { id: string; type: string; at: string; userId?: string; userName?: string; text?: string; emotes: string[]; badges: string[]; sourceBroadcasterId?: string; data: Record<string, unknown>; simulated: boolean }
export function parseMessage(text: string): Envelope | undefined {
 try {
  const m = JSON.parse(text) as Envelope;
  if (!m || typeof m.metadata?.message_id !== 'string' || typeof m.metadata?.message_type !== 'string' || !m.payload || typeof m.payload !== 'object') return undefined;
  return m;
 } catch { return undefined; }
}
export function normalize(m: Envelope): NormalizedEvent | undefined {
 const event = m.payload.event; const type = m.payload.subscription?.type ?? m.metadata.subscription_type;
 if (m.metadata.message_type !== 'notification' || !event || !type) return undefined;
 const message = event.message as {text?: string; fragments?: Array<{type: string; text: string}>} | undefined;
 const badges = Array.isArray(event.badges) ? event.badges.flatMap(b => typeof b?.set_id === 'string' ? [b.set_id] : []) : [];
 return {id:m.metadata.message_id, type, at:m.metadata.message_timestamp, userId: String(event.chatter_user_id ?? event.user_id ?? ''), userName:String(event.chatter_user_name ?? event.user_name ?? ''), text:message?.text, emotes:message?.fragments?.filter(f=>f.type === 'emote').map(f=>f.text) ?? [], badges, sourceBroadcasterId:typeof event.source_broadcaster_user_id === 'string' ? event.source_broadcaster_user_id : undefined, data:event, simulated:false};
}
export class Deduper {
 private seen = new Set<string>();
 accept(id: string): boolean { if (this.seen.has(id)) return false; this.seen.add(id); if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value!); return true; }
}
