/**
 * Names of players in `expectedPlayerIds` who have not yet satisfied `hasSubmitted`.
 */
export function pendingSubmitNamesFromExpected(room, expectedPlayerIds, hasSubmitted) {
  return expectedPlayerIds
    .filter((id) => !hasSubmitted(id))
    .map((id) => room.players.find((player) => player.id === id)?.name || "Unknown");
}
