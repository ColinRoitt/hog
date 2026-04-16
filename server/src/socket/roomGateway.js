import { CLIENT_EVENTS, DEFAULT_GAME_TYPE, SERVER_EVENTS } from "shared";

function send(socket, type, payload) {
  if (!socket || socket.readyState !== 1) {
    return;
  }

  socket.send(JSON.stringify({ type, payload }));
}

export function createRoomGateway({ wss, roomStore, minigameRegistry }) {
  function broadcastRoomState(room) {
    room.players.forEach((player) => {
      if (!player.socket) {
        return;
      }

      send(
        player.socket,
        SERVER_EVENTS.ROOM_STATE,
        roomStore.buildClientRoomState(room, player.id),
      );
    });
  }

  function broadcastError(socket, message) {
    send(socket, SERVER_EVENTS.ERROR, { message });
  }

  wss.on("connection", (socket) => {
    send(socket, SERVER_EVENTS.CONNECTED, { ok: true });

    socket.on("message", (rawMessage) => {
      let message;

      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        broadcastError(socket, "Invalid message payload.");
        return;
      }

      if (message.type === CLIENT_EVENTS.JOIN_ROOM) {
        const result = roomStore.joinRoom({
          roomName: message.payload.roomName,
          playerName: message.payload.playerName,
          sessionId: message.payload.sessionId,
          socket,
        });

        if (result.error) {
          broadcastError(socket, result.error);
          return;
        }

        socket.roomKey = result.room.key;
        socket.playerId = result.player.id;
        broadcastRoomState(result.room);
        return;
      }

      if (!socket.roomKey || !socket.playerId) {
        broadcastError(socket, "Join a room before sending game events.");
        return;
      }

      const room = roomStore.getRoom(socket.roomKey);
      if (!room) {
        broadcastError(socket, "That room no longer exists.");
        return;
      }

      gateway.handleEvent(room, socket, message);
    });

    socket.on("close", () => {
      const room = roomStore.disconnectSocket(socket);
      if (room) {
        broadcastRoomState(room);
      }
    });
  });

  const gateway = {
    handleEvent(room, socket, message) {
      if (message.type === CLIENT_EVENTS.START_GAME) {
        if (room.hostId !== socket.playerId) {
          broadcastError(socket, "Only the host can start the game.");
          return;
        }

        const result = minigameRegistry.start(
          room,
          message.payload.gameType || room.selectedGameType || DEFAULT_GAME_TYPE,
          () => broadcastRoomState(room),
        );
        if (result.error) {
          broadcastError(socket, result.error);
          return;
        }

        broadcastRoomState(room);
        return;
      }

      if (message.type === CLIENT_EVENTS.RETURN_TO_LOBBY) {
        if (room.hostId !== socket.playerId) {
          broadcastError(socket, "Only the host can return everyone to the lobby.");
          return;
        }

        room.game = null;
        broadcastRoomState(room);
        return;
      }

      if (
        message.type === CLIENT_EVENTS.SUBMIT_FAKE_ANSWER ||
        message.type === CLIENT_EVENTS.SUBMIT_GUESS ||
        message.type === CLIENT_EVENTS.SUBMIT_DISTINCTLY_AVERAGE_GUESS ||
        message.type === CLIENT_EVENTS.SUBMIT_IM_TERRIBLE_AT_DATING_GUESS ||
        message.type === CLIENT_EVENTS.SUBMIT_MAP_GUESS ||
        message.type === CLIENT_EVENTS.NEXT_MAP_REVEAL_STEP ||
        message.type === CLIENT_EVENTS.NEXT_MAP_ROUND ||
        message.type === CLIENT_EVENTS.NEXT_ROUND
      ) {
        const result = minigameRegistry.handleEvent(
          room,
          {
            type: message.type,
            playerId: socket.playerId,
            payload: message.payload || {},
          },
          () => broadcastRoomState(room),
        );
        if (result.error) {
          broadcastError(socket, result.error);
        }
        return;
      }
    },
    broadcastRoomState,
    broadcastError,
  };

  return gateway;
}
