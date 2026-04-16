export function createMinigameRegistry(minigames) {
  const byType = new Map(minigames.map((minigame) => [minigame.type, minigame]));

  function get(type) {
    return byType.get(type) || null;
  }

  function getAvailableGames() {
    return minigames.map((minigame) => ({
      type: minigame.type,
      name: minigame.name,
      description: minigame.description,
    }));
  }

  function start(room, gameType, onStateChange) {
    const minigame = get(gameType);
    if (!minigame) {
      return { error: "That minigame is not available." };
    }

    return minigame.start(room, { onStateChange });
  }

  function handleEvent(room, event, onStateChange) {
    const minigame = room.game ? get(room.game.type) : null;
    if (!minigame) {
      return { error: "No active minigame is running." };
    }

    return minigame.handleEvent(room, event, { onStateChange });
  }

  function buildClientGameState(room, playerId) {
    if (!room.game) {
      return null;
    }

    const minigame = get(room.game.type);
    if (!minigame) {
      return null;
    }

    return minigame.buildClientState(room, { playerId });
  }

  return {
    getAvailableGames,
    start,
    handleEvent,
    buildClientGameState,
  };
}
