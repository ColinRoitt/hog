import { CLIENT_EVENTS, GAME_PHASES, GAME_TYPE } from "shared";
import { pendingSubmitNamesFromExpected } from "./submissionWaitHelpers.js";

const PUNCHLINE_REVEAL_DELAY_MS = 5000;

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function derangedTargets(order) {
  const n = order.length;
  if (n < 2) {
    return null;
  }

  for (let attempt = 0; attempt < 800; attempt += 1) {
    const targets = shuffle([...order]);
    if (!targets.some((targetId, index) => targetId === order[index])) {
      return targets;
    }
  }

  return null;
}

/** Each writer id maps to a different setup owner id (writer finishes someone else's setup). */
function buildPunchlineAssignment(participantIds) {
  const writers = shuffle([...participantIds]);
  const setupOwners = derangedTargets(writers);
  if (!setupOwners) {
    return null;
  }

  const punchlineAssignment = {};
  writers.forEach((writerId, index) => {
    punchlineAssignment[writerId] = setupOwners[index];
  });
  return punchlineAssignment;
}

function getConnectedPlayerIds(room) {
  return room.players.filter((player) => player.connected).map((player) => player.id);
}

function clearRevealTimer(game) {
  if (!game?.punchlineRevealTimer) {
    return;
  }

  clearTimeout(game.punchlineRevealTimer);
  game.punchlineRevealTimer = null;
}

function schedulePunchlineReveal(room, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.JOKER_REVEAL || !game.currentRound) {
    return;
  }

  const expectedRoundNumber = game.roundNumber;
  const expectedRevealIndex = game.currentRound.activeRevealIndex;
  clearRevealTimer(game);
  game.punchlineRevealTimer = setTimeout(() => {
    const liveGame = room.game;
    if (
      !liveGame ||
      liveGame.type !== GAME_TYPE.JOKER ||
      liveGame.phase !== GAME_PHASES.JOKER_REVEAL ||
      !liveGame.currentRound ||
      liveGame.roundNumber !== expectedRoundNumber ||
      liveGame.currentRound.activeRevealIndex !== expectedRevealIndex
    ) {
      return;
    }

    liveGame.currentRound.isActivePunchlineVisible = true;
    liveGame.punchlineRevealTimer = null;
    onStateChange();
  }, PUNCHLINE_REVEAL_DELAY_MS);
}

function advanceRound(room, onStateChange) {
  const game = room.game;
  if (!game) {
    return;
  }

  clearRevealTimer(game);

  const participantIds = getConnectedPlayerIds(room);
  if (participantIds.length < 2) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  game.roundNumber += 1;
  game.phase = GAME_PHASES.JOKER_SETUPS;

  game.currentRound = {
    participantIds: [...participantIds],
    setups: {},
    punchlineAssignment: {},
    punchlines: {},
    revealPairs: [],
  };

  onStateChange();
}

function startGame(room, { onStateChange }) {
  const participantIds = getConnectedPlayerIds(room);
  if (participantIds.length < 2) {
    return { error: "Joker needs at least 2 connected players." };
  }

  room.game = {
    type: GAME_TYPE.JOKER,
    phase: GAME_PHASES.LOBBY,
    roundNumber: 0,
    currentRound: null,
    punchlineRevealTimer: null,
  };

  advanceRound(room, onStateChange);
  return { ok: true };
}

function submitSetup(room, playerId, payload, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.JOKER_SETUPS) {
    return { error: "The game is not collecting joke setups right now." };
  }

  const round = game.currentRound;
  if (!round.participantIds.includes(playerId)) {
    return { error: "You are not in this round." };
  }

  if (round.setups[playerId]) {
    return { error: "You already submitted a setup." };
  }

  const text = String(payload?.setup ?? "").trim();
  if (text.length < 8) {
    return { error: "Write a bit more of a setup (at least 8 characters)." };
  }

  if (text.length > 600) {
    return { error: "Keep the setup under 600 characters." };
  }

  round.setups[playerId] = text;

  const allSetupsIn = round.participantIds.every((id) => round.setups[id]);
  if (!allSetupsIn) {
    onStateChange();
    return { ok: true };
  }

  const assignment = buildPunchlineAssignment(round.participantIds);
  if (!assignment) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return { error: "Could not assign setups; try again with more players." };
  }

  round.punchlineAssignment = assignment;
  game.phase = GAME_PHASES.JOKER_PUNCHLINES;
  onStateChange();
  return { ok: true };
}

function submitPunchline(room, playerId, payload, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.JOKER_PUNCHLINES) {
    return { error: "The game is not collecting punchlines right now." };
  }

  const round = game.currentRound;
  if (!round.participantIds.includes(playerId)) {
    return { error: "You are not in this round." };
  }

  const setupOwnerId = round.punchlineAssignment[playerId];
  if (!setupOwnerId) {
    return { error: "You do not have an assigned setup to punch up." };
  }

  if (round.punchlines[playerId]) {
    return { error: "You already submitted a punchline." };
  }

  const text = String(payload?.punchline ?? "").trim();
  if (!text.length) {
    return { error: "Enter a punchline." };
  }

  if (text.length > 400) {
    return { error: "Keep the punchline under 400 characters." };
  }

  round.punchlines[playerId] = text;

  const allIn = round.participantIds.every((id) => round.punchlines[id]);
  if (!allIn) {
    onStateChange();
    return { ok: true };
  }

  const namesById = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
  const pairs = round.participantIds.map((setupOwnerId) => {
    const writerId = round.participantIds.find((w) => round.punchlineAssignment[w] === setupOwnerId);
    return {
      setupAuthorName: namesById[setupOwnerId] || "Unknown",
      setupText: round.setups[setupOwnerId],
      punchlineAuthorName: namesById[writerId] || "Unknown",
      punchlineText: round.punchlines[writerId],
    };
  });

  round.revealPairs = shuffle(pairs);
  round.activeRevealIndex = -1;
  round.isActivePunchlineVisible = false;
  game.phase = GAME_PHASES.JOKER_REVEAL;
  clearRevealTimer(game);
  onStateChange();
  return { ok: true };
}

function revealNextSetup(room, playerId, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.JOKER_REVEAL) {
    return { error: "The reveal is not active right now." };
  }

  if (room.hostId !== playerId) {
    return { error: "Only the host can reveal the next joke." };
  }

  const round = game.currentRound;
  if (!round?.revealPairs?.length) {
    return { error: "There are no jokes to reveal." };
  }

  if (!round.isActivePunchlineVisible && round.activeRevealIndex >= 0) {
    return { error: "Wait for the current punchline to reveal." };
  }

  const nextIndex = round.activeRevealIndex + 1;
  if (nextIndex >= round.revealPairs.length) {
    return { error: "All jokes are already revealed." };
  }

  round.activeRevealIndex = nextIndex;
  round.isActivePunchlineVisible = false;
  schedulePunchlineReveal(room, onStateChange);
  onStateChange();
  return { ok: true };
}

function advanceToNextRound(room, playerId, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.JOKER_REVEAL) {
    return { error: "The round cannot advance right now." };
  }

  if (room.hostId !== playerId) {
    return { error: "Only the host can start the next round." };
  }

  clearRevealTimer(game);
  advanceRound(room, onStateChange);
  return { ok: true };
}

function buildClientState(room, { playerId }) {
  const game = room.game;
  const round = game.currentRound;
  const namesById = Object.fromEntries(room.players.map((p) => [p.id, p.name]));

  if (!round) {
    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      currentRound: null,
    };
  }

  const pendingSetups = pendingSubmitNamesFromExpected(room, round.participantIds, (id) =>
    Boolean(round.setups[id]),
  );

  const pendingPunchlines = pendingSubmitNamesFromExpected(room, round.participantIds, (id) =>
    Boolean(round.punchlines[id]),
  );

  if (game.phase === GAME_PHASES.JOKER_SETUPS) {
    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      currentRound: {
        submittedSetupCount: Object.keys(round.setups).length,
        expectedSetupCount: round.participantIds.length,
        pendingSubmitNames: pendingSetups,
        hasSubmittedSetup: Boolean(round.setups[playerId]),
      },
    };
  }

  if (game.phase === GAME_PHASES.JOKER_PUNCHLINES) {
    const setupOwnerId = round.punchlineAssignment[playerId];
    const assignedSetupText = setupOwnerId ? round.setups[setupOwnerId] || "" : "";

    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      currentRound: {
        submittedPunchlineCount: Object.keys(round.punchlines).length,
        expectedPunchlineCount: round.participantIds.length,
        pendingSubmitNames: pendingPunchlines,
        hasSubmittedPunchline: Boolean(round.punchlines[playerId]),
        assignedSetupAuthorName: setupOwnerId ? namesById[setupOwnerId] || "Unknown" : "",
        assignedSetupText,
      },
    };
  }

  if (game.phase === GAME_PHASES.JOKER_REVEAL) {
    const activeRevealIndex = round.activeRevealIndex ?? -1;
    const activePair = activeRevealIndex >= 0 ? round.revealPairs[activeRevealIndex] : null;
    const hasMoreSetups = activeRevealIndex + 1 < round.revealPairs.length;
    const isRevealComplete =
      activeRevealIndex === round.revealPairs.length - 1 && round.isActivePunchlineVisible;

    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      currentRound: {
        activePair,
        activeRevealIndex,
        revealCount: round.revealPairs.length,
        isActivePunchlineVisible: Boolean(round.isActivePunchlineVisible),
        canAdvanceReveal:
          activeRevealIndex < 0 || Boolean(round.isActivePunchlineVisible && hasMoreSetups),
        isRevealComplete,
      },
    };
  }

  return {
    type: game.type,
    phase: game.phase,
    roundNumber: game.roundNumber,
    currentRound: null,
  };
}

export function createJokerMinigame() {
  return {
    type: GAME_TYPE.JOKER,
    name: "Joker",
    lobbySection: "parlour",
    description:
      "Everyone writes a joke setup, then gets someone else's setup to punch up. Reveal: setup, then punchline, for the whole room.",
    start(room, { onStateChange }) {
      return startGame(room, { onStateChange });
    },
    handleEvent(room, event, ctx) {
      const { onStateChange } = ctx;
      if (event.type === CLIENT_EVENTS.SUBMIT_JOKER_SETUP) {
        return submitSetup(room, event.playerId, event.payload, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.SUBMIT_JOKER_PUNCHLINE) {
        return submitPunchline(room, event.playerId, event.payload, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_ROUND) {
        return advanceToNextRound(room, event.playerId, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_JOKER_REVEAL) {
        return revealNextSetup(room, event.playerId, onStateChange);
      }

      return { error: "That action is not supported for this minigame." };
    },
    buildClientState,
  };
}
