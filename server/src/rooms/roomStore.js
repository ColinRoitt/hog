import crypto from "node:crypto";
import { DEFAULT_GAME_TYPE } from "shared";

function normalizeRoomName(roomName) {
  return roomName.trim().toLowerCase();
}

export function createRoomStore({ minigameRegistry }) {
  const rooms = new Map();

  function getOrCreateRoom(roomName) {
    const roomKey = normalizeRoomName(roomName);

    if (!rooms.has(roomKey)) {
      rooms.set(roomKey, {
        key: roomKey,
        name: roomName.trim(),
        hostId: null,
        selectedGameType: DEFAULT_GAME_TYPE,
        players: [],
        game: null,
      });
    }

    return rooms.get(roomKey);
  }

  function joinRoom({ roomName, playerName, sessionId, socket }) {
    const trimmedRoom = roomName.trim();
    const trimmedName = playerName.trim();

    if (!trimmedRoom || !trimmedName) {
      return { error: "Name and room are both required." };
    }

    const room = getOrCreateRoom(trimmedRoom);

    let player = room.players.find((entry) => entry.sessionId === sessionId);
    if (!player) {
      player = {
        id: crypto.randomUUID(),
        sessionId,
        name: trimmedName,
        totalPoints: 0,
        connected: true,
        socket,
      };
      room.players.push(player);
    } else {
      player.name = trimmedName;
      player.connected = true;
      player.socket = socket;
    }

    if (!room.hostId) {
      room.hostId = player.id;
    }

    return { room, player };
  }

  function disconnectSocket(socket) {
    for (const room of rooms.values()) {
      const player = room.players.find((entry) => entry.socket === socket);
      if (!player) {
        continue;
      }

      player.connected = false;
      player.socket = null;

      const connectedPlayers = room.players.filter((entry) => entry.connected);
      if (room.hostId === player.id) {
        room.hostId = connectedPlayers[0]?.id || null;
      }

      if (connectedPlayers.length === 0) {
        rooms.delete(room.key);
      }

      return room;
    }

    return null;
  }

  function getRoom(roomKey) {
    return rooms.get(roomKey) || null;
  }

  function buildClientRoomState(room, playerId) {
    return {
      selfPlayerId: playerId,
      room: {
        name: room.name,
        hostId: room.hostId,
        selectedGameType: room.selectedGameType,
        availableGames: minigameRegistry.getAvailableGames(),
        players: room.players
          .map((player) => ({
            id: player.id,
            name: player.name,
            totalPoints: player.totalPoints || 0,
            connected: player.connected,
            isHost: player.id === room.hostId,
          }))
          .sort((left, right) => {
            if (right.totalPoints !== left.totalPoints) {
              return right.totalPoints - left.totalPoints;
            }

            return left.name.localeCompare(right.name);
          }),
      },
      game: minigameRegistry.buildClientGameState(room, playerId),
    };
  }

  function getPlayerSocket(room, playerId) {
    return room.players.find((player) => player.id === playerId)?.socket || null;
  }

  return {
    joinRoom,
    disconnectSocket,
    getRoom,
    buildClientRoomState,
    getPlayerSocket,
  };
}
