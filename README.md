# Previously On

A local Twitch companion intended to turn stream moments into a TV-style cold open. The current build connects Twitch OAuth and EventSub to a live status feed; the recap experience is not built yet.

## Setup

Install Node.js 20 or later and run `npm install`. Phase 1 was tested with Node 24.22.1; Node 20 and Node 26 have not been verified. Register a confidential Twitch developer application and set its OAuth redirect URI to `http://localhost:3000/auth/callback`. Copy `.env.example` to `.env` and fill in the Twitch client ID and secret. Never commit `.env` or `data/`.

Run `npm run dev`, then open `http://localhost:3000/status` and connect Twitch. If PORT is changed, register the corresponding callback URI. The server binds only to 127.0.0.1. OAuth tokens are stored locally in `data/previously-on.db`.

Scopes: `user:read:chat` (chat events), `user:write:chat` (send), `clips:edit` (create clips), `channel:manage:clips` (download and VOD clips), `moderator:manage:chat_messages` (pin), and `moderator:read:followers` (follows). Chat subscription notifications use `user:read:chat`; no subscription-read scope is needed for the planned EventSub type.

Commands: `npm test`, `npm run typecheck`, `npm run build`, `npm start`. `npm run demo` starts a simulated event feed without connecting to Twitch; all simulated events are labeled. The demo has simulated online/offline buttons. `OPENAI_API_KEY` and `OPENAI_MODEL` are reserved for future caption generation. Stop the running server before switching modes.

## How Codex was used

Codex is implementing this project in phases in collaboration with the product owner. Phase 1 added server and OAuth; Phase 2 adds EventSub, a status feed, simulated events, and mocked reconnection tests. Twitch login and EventSub subscription creation have been exercised live. Chat delivery is awaiting the live gate.
