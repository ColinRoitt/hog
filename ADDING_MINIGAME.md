# Adding a New Minigame

This project uses a minigame plugin pattern:

- Server minigame logic lives in `server/src/game/`
- The server registers minigames in `server/src/index.js`
- The client maps `game.type` to a React view in `client/src/minigames/index.js`

## 1) Add a new game type and events

Update `shared/src/events.js`:

```js
export const GAME_TYPE = {
  AND_THE_ANSWER_ISNT: "and_the_answer_isnt",
  FASTEST_FINGER: "fastest_finger", // new
};

export const CLIENT_EVENTS = {
  // existing...
  SUBMIT_FASTEST_FINGER: "submit_fastest_finger", // optional
};
```

If your game needs extra client actions, add new event names here.

## 2) Create the server minigame module

Create `server/src/game/fastestFinger.js`:

```js
import { CLIENT_EVENTS, GAME_PHASES, GAME_TYPE } from "shared";

export function createFastestFingerMinigame() {
  return {
    type: GAME_TYPE.FASTEST_FINGER,
    name: "Fastest Finger",
    description: "First correct answer scores.",

    start(room, { onStateChange }) {
      const connectedPlayers = room.players.filter((player) => player.connected);
      if (connectedPlayers.length < 2) {
        return { error: "At least 2 connected players are needed to start." };
      }

      room.game = {
        type: GAME_TYPE.FASTEST_FINGER,
        phase: GAME_PHASES.GUESSING,
        roundNumber: 1,
        scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
        prompt: "2 + 2 = ?",
        winnerId: null,
      };

      onStateChange();
      return { ok: true };
    },

    handleEvent(room, event, { onStateChange }) {
      if (event.type !== CLIENT_EVENTS.SUBMIT_FASTEST_FINGER) {
        return { error: "That action is not supported for this minigame." };
      }

      if (!room.game || room.game.phase !== GAME_PHASES.GUESSING) {
        return { error: "Round is not accepting answers." };
      }

      const answer = String(event.payload.answer || "").trim();
      if (!answer) {
        return { error: "Answer is required." };
      }

      if (answer === "4" && !room.game.winnerId) {
        room.game.winnerId = event.playerId;
        room.game.scores[event.playerId] = (room.game.scores[event.playerId] || 0) + 1;
        room.game.phase = GAME_PHASES.FINISHED;
      }

      onStateChange();
      return { ok: true };
    },

    buildClientState(room, { playerId }) {
      const game = room.game;
      const playerNamesById = Object.fromEntries(room.players.map((p) => [p.id, p.name]));

      return {
        type: game.type,
        phase: game.phase,
        roundNumber: game.roundNumber,
        prompt: game.prompt,
        isWinner: game.winnerId === playerId,
        winnerName: game.winnerId ? playerNamesById[game.winnerId] || "Unknown" : null,
        scoreboard: room.players
          .map((player) => ({
            id: player.id,
            name: player.name,
            score: game.scores[player.id] || 0,
          }))
          .sort((a, b) => b.score - a.score),
      };
    },
  };
}
```

Server minigame contract:

- `type`: one of `GAME_TYPE`
- `name`: shown in lobby
- `description`: shown in lobby
- `start(room, { onStateChange })`
- `handleEvent(room, event, { onStateChange })`
- `buildClientState(room, { playerId })`

## 3) Register it on the server

Update `server/src/index.js`:

```js
import { createFastestFingerMinigame } from "./game/fastestFinger.js";

const minigameRegistry = createMinigameRegistry([
  createAndTheAnswerIsntMinigame({ questions }),
  createFastestFingerMinigame(), // new
]);
```

## 4) Allow new game events through the gateway

Update `server/src/socket/roomGateway.js` to pass your new event to `minigameRegistry.handleEvent(...)`.

Current gateway pattern checks specific event names before dispatching to the active minigame. Add your event to that allowlist.

## 5) Add the client game view

Create `client/src/minigames/fastestFinger/GameView.jsx`:

```jsx
import { GAME_PHASES } from "shared";

export function FastestFingerGameView({ roomState, onSubmitFastestFinger }) {
  const game = roomState.game;

  return (
    <main className="shell">
      <section className="card">
        <h1>Fastest Finger</h1>
        <p>{game.prompt}</p>

        {game.phase === GAME_PHASES.GUESSING ? (
          <button onClick={() => onSubmitFastestFinger("4")}>Submit Answer</button>
        ) : (
          <p>Winner: {game.winnerName}</p>
        )}
      </section>
    </main>
  );
}
```

Register it in `client/src/minigames/index.js`:

```js
import { GAME_TYPE } from "shared";
import { FastestFingerGameView } from "./fastestFinger/GameView";

export const gameViewsByType = {
  [GAME_TYPE.AND_THE_ANSWER_ISNT]: AndTheAnswerIsntGameView,
  [GAME_TYPE.FASTEST_FINGER]: FastestFingerGameView, // new
};
```

## 6) Add a socket helper for your new action

Update `client/src/lib/socket.js`:

```js
submitFastestFinger(answer) {
  socket.send(
    JSON.stringify({
      type: CLIENT_EVENTS.SUBMIT_FASTEST_FINGER,
      payload: { answer },
    }),
  );
}
```

Pass that callback through `client/src/App.jsx` into your new game view.

## Leaflet + OpenStreetMap tiles (map minigames)

If your minigame uses `react-leaflet` + OSM raster tiles:

- Add dependencies in `client/package.json` (`leaflet`, `react-leaflet`) and run `npm install` at the repo root.
- Import Leaflet CSS once in `client/src/main.jsx`:

```js
import "leaflet/dist/leaflet.css";
```

- Use a standard OSM tile URL in your `TileLayer`:

```jsx
<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
```

Deployment notes:

- When served behind a reverse proxy, prefer routing both HTTP and WebSockets through the same public hostname so the client can connect to `wss://` without extra env configuration.
- If you need a different tile provider or attribution requirements, swap the `TileLayer` URL accordingly.

### Continent-scoped map data (`Where is Kazakhstan?`)

`server/src/questions/whereIsKazakhstanQuestions.json` uses a continent bank:

```json
{
  "continents": {
    "NorthAmerica": [{ "name": "Mexico City", "lat": 19.4326, "lon": -99.1332 }],
    "Europe": [{ "name": "Paris", "lat": 48.8566, "lon": 2.3522 }]
  }
}
```

Supported continent keys (server-side): `NorthAmerica`, `SouthAmerica`, `Europe`, `Asia`, `MiddleEast`, `Oceania`.

## Quick checklist

- Add new `GAME_TYPE` (and any new `CLIENT_EVENTS`)
- Create server minigame module (`start`, `handleEvent`, `buildClientState`)
- Register minigame in `server/src/index.js`
- Update gateway event allowlist if needed
- Add client game view component
- Register game view in `client/src/minigames/index.js`
- Add client socket send helper(s)
- Build and smoke test with at least 2 tabs
