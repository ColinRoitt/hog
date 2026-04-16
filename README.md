# House of Games (Web MVP)

Browser-based multiplayer minigames inspired by House of Games.

Players join with just a name + room, meet in a shared lobby, then start a minigame.

## Current Stack

- `client/`: React + Vite
- `server/`: Node + Express + WebSocket (`ws`)
- `shared/`: shared event names, game types, and minigame metadata

## Architecture

### Realtime flow

1. Client opens a WebSocket and sends `join_room`.
2. Server keeps authoritative room + game state in memory.
3. Server broadcasts `room_state` to every connected player in the room.
4. Client renders either:
   - join page
   - lobby
   - active minigame view

### Minigame architecture

Minigames are plugins behind a small contract:

- `start(room, { onStateChange })`
- `handleEvent(room, event, { onStateChange })`
- `buildClientState(room, { playerId })`

The server registry in `server/src/game/minigameRegistry.js`:

- exposes available games for lobby UI
- starts a chosen game
- routes game-specific events to the active game
- asks the game to shape player-specific client state

Client game rendering is also modular:

- `client/src/minigames/index.js` maps `game.type` -> React view component
- `client/src/pages/GamePage.jsx` dispatches to the selected game view

## Project Layout

- `client/src/pages/` core app screens
- `client/src/minigames/` per-minigame UI
- `server/src/socket/roomGateway.js` websocket event entrypoint
- `server/src/rooms/roomStore.js` room/player lifecycle + lobby payload
- `server/src/game/` minigame registry and minigame modules
- `shared/src/` shared protocol/constants

## Add a New Minigame

Full guide: [Adding a New Minigame](./ADDING_MINIGAME.md)

Reusable server template:

- `server/src/game/templateMinigame.js`

## Local Development

Install dependencies:

```bash
npm install
```

Run client + server together:

```bash
npm run dev
```

Build client:

```bash
npm run build
```
