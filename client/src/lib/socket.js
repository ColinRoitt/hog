import { CLIENT_EVENTS, SERVER_EVENTS } from "shared";

function getWebSocketUrl() {
  const configuredUrl = import.meta.env.VITE_WS_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  // Vite dev server (5173): API + WebSocket still run on the Node port (default 3001).
  // Production / Docker + NPM: page and WS share the public host (e.g. wss://hog.example.com).
  if (import.meta.env.DEV) {
    return `${protocol}//${window.location.hostname}:3001`;
  }

  return `${protocol}//${window.location.host}`;
}

export function connectToRoom({ playerName, roomName, sessionId, onRoomState, onError }) {
  const socket = new WebSocket(getWebSocketUrl());

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: CLIENT_EVENTS.JOIN_ROOM,
        payload: {
          playerName,
          roomName,
          sessionId,
        },
      }),
    );
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === SERVER_EVENTS.ROOM_STATE) {
      onRoomState(message.payload);
    }

    if (message.type === SERVER_EVENTS.ERROR) {
      onError(message.payload.message);
    }
  });

  socket.addEventListener("close", () => {
    onError("Disconnected from server.");
  });

  return {
    socket,
    startGame(gameType) {
      socket.send(JSON.stringify({ type: CLIENT_EVENTS.START_GAME, payload: { gameType } }));
    },
    returnToLobby() {
      socket.send(JSON.stringify({ type: CLIENT_EVENTS.RETURN_TO_LOBBY, payload: {} }));
    },
    submitFakeAnswer(answer) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_FAKE_ANSWER,
          payload: { answer },
        }),
      );
    },
    submitGuess(optionId) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_GUESS,
          payload: { optionId },
        }),
      );
    },
    submitDistinctlyAverageGuess(guess) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_DISTINCTLY_AVERAGE_GUESS,
          payload: { guess },
        }),
      );
    },
    submitImTerribleAtDatingGuess(guess) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_IM_TERRIBLE_AT_DATING_GUESS,
          payload: { guess },
        }),
      );
    },
    submitMapGuess({ lat, lon }) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_MAP_GUESS,
          payload: { lat, lon },
        }),
      );
    },
    nextMapRevealStep() {
      socket.send(JSON.stringify({ type: CLIENT_EVENTS.NEXT_MAP_REVEAL_STEP, payload: {} }));
    },
    nextMapRound() {
      socket.send(JSON.stringify({ type: CLIENT_EVENTS.NEXT_MAP_ROUND, payload: {} }));
    },
    nextRound() {
      socket.send(JSON.stringify({ type: CLIENT_EVENTS.NEXT_ROUND, payload: {} }));
    },
    submitTotesEmojiClue(emoji) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_TOTES_EMOJI_CLUE,
          payload: { emoji },
        }),
      );
    },
    submitTotesEmojiTitleGuess(title) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_TOTES_EMOJI_TITLE_GUESS,
          payload: { title },
        }),
      );
    },
    rerollTotesEmojiTitle() {
      socket.send(JSON.stringify({ type: CLIENT_EVENTS.REROLL_TOTES_EMOJI_TITLE, payload: {} }));
    },
    submitNiceRoundClue(word) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_NICE_ROUND_CLUE,
          payload: { word },
        }),
      );
    },
    submitNiceRoundTitleGuess(title) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_NICE_ROUND_TITLE_GUESS,
          payload: { title },
        }),
      );
    },
    submitNiceRoundBestClue(pickedPlayerId) {
      socket.send(
        JSON.stringify({
          type: CLIENT_EVENTS.SUBMIT_NICE_ROUND_BEST_CLUE,
          payload: { pickedPlayerId },
        }),
      );
    },
    disconnect() {
      socket.close();
    },
  };
}
