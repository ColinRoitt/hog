import { GAME_PHASES, GAME_TYPE } from "shared";

// Copy this file, rename it, and replace placeholders.
// Suggested new filename: yourGameName.js
export function createTemplateMinigame() {
  return {
    // Replace with your real game type from shared/src/events.js
    type: GAME_TYPE.AND_THE_ANSWER_ISNT,
    // Name and description are shown in the lobby.
    name: "Template Minigame",
    description: "Replace this with your game summary.",

    start(room, { onStateChange }) {
      const connectedPlayers = room.players.filter((player) => player.connected);
      if (connectedPlayers.length < 2) {
        return { error: "At least 2 connected players are needed to start." };
      }

      // Define server-authoritative game state.
      room.game = {
        type: this.type,
        phase: GAME_PHASES.GUESSING,
        roundNumber: 1,
        scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
        // Add game-specific fields here.
        prompt: "Replace with real prompt data",
      };

      onStateChange();
      return { ok: true };
    },

    handleEvent(room, event, { onStateChange }) {
      if (!room.game) {
        return { error: "No active game found." };
      }

      switch (event.type) {
        // Add your game-specific events in shared/src/events.js and handle them here.
        // case CLIENT_EVENTS.SUBMIT_YOUR_ACTION:
        //   // mutate room.game and room.players as needed
        //   onStateChange();
        //   return { ok: true };
        default:
          return { error: "That action is not supported for this minigame." };
      }
    },

    buildClientState(room, { playerId }) {
      const game = room.game;
      const playersById = Object.fromEntries(room.players.map((player) => [player.id, player]));

      return {
        type: game.type,
        phase: game.phase,
        roundNumber: game.roundNumber,
        // Keep this payload minimal: only send what the UI needs.
        prompt: game.prompt,
        selfPlayerId: playerId,
        players: room.players.map((player) => ({
          id: player.id,
          name: player.name,
          totalPoints: player.totalPoints || 0,
          score: game.scores[player.id] || 0,
        })),
        // Example of per-player visibility:
        selfName: playersById[playerId]?.name || "Unknown",
      };
    },
  };
}

// Example usage in server/src/index.js:
// import { createTemplateMinigame } from "./game/templateMinigame.js";
// const minigameRegistry = createMinigameRegistry([
//   createAndTheAnswerIsntMinigame({ questions }),
//   createTemplateMinigame(),
// ]);
