# Previously On

A local Twitch companion intended to turn stream moments into a TV-style cold open. The current build connects Twitch OAuth and EventSub, detects moments, captures clips, and drafts episodes. Studio editing and overlay playback are not built yet.

## Setup

Install Node.js 20 or later and run `npm install`. Phase 1 was tested with Node 24.22.1; Node 20 and Node 26 have not been verified. Register a confidential Twitch developer application and set its OAuth redirect URI to `http://localhost:3000/auth/callback`. Copy `.env.example` to `.env` and fill in the Twitch client ID and secret. Never commit `.env` or `data/`.

Run `npm run dev`, then open `http://localhost:3000/status` and connect Twitch. If PORT is changed, register the corresponding callback URI. The server binds only to 127.0.0.1. OAuth tokens are stored locally in `data/previously-on.db`.

Scopes: `user:read:chat` (chat events), `user:write:chat` (send), `clips:edit` (create clips), `channel:manage:clips` (download and VOD clips), `moderator:manage:chat_messages` (pin), and `moderator:read:followers` (follows). Chat subscription notifications use `user:read:chat`; no subscription-read scope is needed for the planned EventSub type.

Commands: `npm test`, `npm run typecheck`, `npm run build`, `npm start`. `npm run demo` starts a simulated event feed without connecting to Twitch; all simulated events are labeled. The demo has simulated online/offline buttons. `OPENAI_API_KEY` and `OPENAI_MODEL` are reserved for future caption generation. Stop the running server before switching modes.

Moment detection uses five-second buckets and the thresholds and weights in `config.json`. While live, viewers can nominate with `!banger`, or the broadcaster can use Mark moment on the status page. New moments enqueue Twitch clip creation, poll for up to 60 seconds per attempt, and retry once. After a stream ends, session clips are imported. Downloaded files are stored in `data/media`. Twitch clips must be enabled in the broadcaster's Creator Dashboard. Real clip creation and downloads have not yet been verified live.

In demo mode, use SIMULATED online and Mark moment on the status page to create a simulated moment tied to the bundled synthetic sample video. The server-side helpers for local MP4 attachment and VOD recapture are not yet exposed in Studio.

After a live session ends and clips finish importing, a draft is built from up to three playable clips with up to three alternatives. Use Build episode on the status page to retry drafting the most recent completed stream. Clips shorter than seven seconds use their available duration; estimated trims are flagged for review. A key and model in `OPENAI_API_KEY` and `OPENAI_MODEL` enable optional caption selection; otherwise the app uses a fixed caption. Captions are restricted to safe generic templates, and no key is sent to the browser.

## How Codex was used

Codex is implementing this project in phases in collaboration with the product owner. Phase 1 added server and OAuth; Phase 2 added EventSub, a status feed, simulated events, and mocked reconnection tests; Phase 3 added a fixture-tested moment engine; Phase 4 adds clip creation, polling, import and download. Twitch login, EventSub subscriptions, and chat message delivery have been exercised live.
