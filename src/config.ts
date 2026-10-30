import 'dotenv/config';
export const scopes = ['user:read:chat','user:write:chat','clips:edit','channel:manage:clips','moderator:manage:chat_messages','moderator:read:followers'] as const;
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port');
export const config = { port, clientId: process.env.TWITCH_CLIENT_ID || '', clientSecret: process.env.TWITCH_CLIENT_SECRET || '', redirectUri: `http://localhost:${port}/auth/callback` };
