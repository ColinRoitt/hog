import { CLIENT_EVENTS, GAME_PHASES, GAME_TYPE } from "shared";

const THEMES = ["tv_show", "movie", "book"];

const THEME_LABELS = {
  tv_show: "TV show",
  movie: "Movie",
  book: "Book",
};

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function normalizeTitle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getConnectedPlayerIds(room) {
  return room.players.filter((player) => player.connected).map((player) => player.id);
}

function awardPoints(room, playerId, points) {
  room.game.scores[playerId] = (room.game.scores[playerId] || 0) + points;

  const player = room.players.find((entry) => entry.id === playerId);
  if (player) {
    player.totalPoints = (player.totalPoints || 0) + points;
  }
}

function buildScoreboard(room) {
  return room.players
    .map((player) => ({
      id: player.id,
      name: player.name,
      score: room.game.scores[player.id] || 0,
    }))
    .sort((left, right) => right.score - left.score);
}

function isSingleWordClue(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed.length > 48) {
    return false;
  }

  if (/\s/u.test(trimmed)) {
    return false;
  }

  return /^[\p{L}\p{N}'\-]+$/u.test(trimmed);
}

function advanceRound(room, titleBank, onStateChange) {
  const game = room.game;
  if (!game) {
    return;
  }

  const participantIds = getConnectedPlayerIds(room);
  if (participantIds.length < 2) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const pool = titleBank[theme] || [];
  if (!pool.length) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  const answerTitle = pool[Math.floor(Math.random() * pool.length)];
  game.roundNumber += 1;
  const guesserId = game.guesserCycle[(game.roundNumber - 1) % game.guesserCycle.length];
  const clueGiverOrder = shuffle(participantIds.filter((id) => id !== guesserId));

  game.phase = GAME_PHASES.NICE_ROUND_CLUES;

  game.currentRound = {
    theme,
    themeLabel: THEME_LABELS[theme] || theme,
    answerTitle,
    guesserId,
    clueGiverOrder,
    clues: [],
    titleOptions: [...pool].sort((a, b) => a.localeCompare(b)),
    guessCorrect: null,
    pickedBestCluePlayerId: null,
  };

  onStateChange();
}

function startGame(room, titleBank, onStateChange) {
  const participantIds = getConnectedPlayerIds(room);
  if (participantIds.length < 2) {
    return { error: "The Nice Round needs at least 2 connected players." };
  }

  room.game = {
    type: GAME_TYPE.NICE_ROUND,
    phase: GAME_PHASES.LOBBY,
    roundNumber: 0,
    scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
    guesserCycle: shuffle([...participantIds]),
    currentRound: null,
  };

  advanceRound(room, titleBank, onStateChange);
  return { ok: true };
}

function submitClue(room, playerId, payload, titleBank, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.NICE_ROUND_CLUES) {
    return { error: "The game is not collecting one-word clues right now." };
  }

  const round = game.currentRound;

  if (playerId === round.guesserId) {
    return { error: "The guesser cannot submit a clue." };
  }

  if (!round.clueGiverOrder.includes(playerId)) {
    return { error: "You are not giving clues this round." };
  }

  if (round.clues.some((entry) => entry.playerId === playerId)) {
    return { error: "You already submitted your clue." };
  }

  const word = String(payload?.word ?? "").trim();
  if (!isSingleWordClue(word)) {
    return { error: "Enter exactly one word (letters, numbers, hyphen, or apostrophe only)." };
  }

  const playerName = room.players.find((p) => p.id === playerId)?.name || "Unknown";
  round.clues.push({ playerId, playerName, word });

  if (round.clues.length >= round.clueGiverOrder.length) {
    game.phase = GAME_PHASES.NICE_ROUND_GUESSING;
  }

  onStateChange();
  return { ok: true };
}

function submitTitleGuess(room, playerId, payload, titleBank, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.NICE_ROUND_GUESSING) {
    return { error: "The guesser cannot submit a title guess right now." };
  }

  const round = game.currentRound;
  if (playerId !== round.guesserId) {
    return { error: "Only the guesser can submit the title guess." };
  }

  const guessRaw = String(payload?.title ?? "").trim();
  if (!guessRaw) {
    return { error: "Enter a title guess." };
  }

  const correct = normalizeTitle(guessRaw) === normalizeTitle(round.answerTitle);
  round.guessCorrect = correct;

  if (correct) {
    awardPoints(room, round.guesserId, 1);
    game.phase = GAME_PHASES.NICE_ROUND_PICK_BEST;
  } else {
    game.phase = GAME_PHASES.REVEAL;
  }

  onStateChange();
  return { ok: true };
}

function submitBestCluePick(room, playerId, payload, titleBank, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.NICE_ROUND_PICK_BEST) {
    return { error: "You cannot pick a best clue right now." };
  }

  const round = game.currentRound;
  if (playerId !== round.guesserId) {
    return { error: "Only the guesser can award the best-clue point." };
  }

  const pickedId = String(payload?.pickedPlayerId ?? "").trim();
  if (!pickedId || !round.clueGiverOrder.includes(pickedId)) {
    return { error: "Pick one of the players who gave you a clue." };
  }

  round.pickedBestCluePlayerId = pickedId;
  awardPoints(room, pickedId, 1);
  game.phase = GAME_PHASES.REVEAL;

  onStateChange();
  return { ok: true };
}

function advanceToNextRound(room, playerId, titleBank, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.REVEAL) {
    return { error: "The round cannot advance right now." };
  }

  if (room.hostId !== playerId) {
    return { error: "Only the host can move to the next round." };
  }

  advanceRound(room, titleBank, onStateChange);
  return { ok: true };
}

function buildClueClientSlice(round, game, playerId) {
  const expected = round.clueGiverOrder.length;
  const submitted = round.clues.length;
  const inGathering = game.phase === GAME_PHASES.NICE_ROUND_CLUES;
  const gatheringComplete = !inGathering || submitted >= expected;

  const orderedClues = round.clueGiverOrder
    .map((id) => round.clues.find((entry) => entry.playerId === id))
    .filter(Boolean)
    .map((entry) => ({
      playerName: entry.playerName,
      word: entry.word,
    }));

  const mine = round.clues.find((entry) => entry.playerId === playerId);

  return {
    clueSubmittedCount: submitted,
    clueExpectedCount: expected,
    clueGatheringComplete: gatheringComplete,
    clues: gatheringComplete ? orderedClues : [],
    myLockedClue: inGathering && !gatheringComplete && mine ? mine.word : null,
    canSubmitClue:
      inGathering &&
      !gatheringComplete &&
      playerId !== round.guesserId &&
      round.clueGiverOrder.includes(playerId) &&
      !mine,
  };
}

function buildClientState(room, { playerId }) {
  const game = room.game;
  const round = game.currentRound;
  const playersById = Object.fromEntries(room.players.map((player) => [player.id, player.name]));

  if (!round) {
    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      currentRound: null,
    };
  }

  const isGuesser = playerId === round.guesserId;
  const clueSlice = buildClueClientSlice(round, game, playerId);
  const base = {
    themeLabel: round.themeLabel,
    guesserId: round.guesserId,
    guesserName: playersById[round.guesserId] || "Unknown",
    isGuesser,
    titleOptions: round.titleOptions,
    ...clueSlice,
  };

  if (game.phase === GAME_PHASES.NICE_ROUND_CLUES || game.phase === GAME_PHASES.NICE_ROUND_GUESSING) {
    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      currentRound: {
        ...base,
        knowAnswer: !isGuesser,
        answerTitle: !isGuesser ? round.answerTitle : null,
      },
    };
  }

  if (game.phase === GAME_PHASES.NICE_ROUND_PICK_BEST) {
    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      currentRound: {
        ...base,
        knowAnswer: true,
        answerTitle: round.answerTitle,
        bestClueOptions: round.clueGiverOrder.map((id) => ({
          playerId: id,
          playerName: playersById[id] || "Unknown",
        })),
      },
    };
  }

  if (game.phase === GAME_PHASES.REVEAL) {
    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      currentRound: {
        ...base,
        knowAnswer: true,
        answerTitle: round.answerTitle,
        guessCorrect: round.guessCorrect,
        pickedBestCluePlayerId: round.pickedBestCluePlayerId,
        pickedBestCluePlayerName: round.pickedBestCluePlayerId
          ? playersById[round.pickedBestCluePlayerId] || "Unknown"
          : null,
      },
    };
  }

  return {
    type: game.type,
    phase: game.phase,
    roundNumber: game.roundNumber,
    scoreboard: buildScoreboard(room),
    currentRound: null,
  };
}

export function createNiceRoundMinigame({ titlesByTheme }) {
  return {
    type: GAME_TYPE.NICE_ROUND,
    name: "The Nice Round",
    description:
      "One player guesses a title while everyone else enters one-word clues at the same time. Right guess scores the guesser, who then picks who had the best clue for a bonus point.",
    start(room, { onStateChange }) {
      return startGame(room, titlesByTheme, onStateChange);
    },
    handleEvent(room, event, { onStateChange }) {
      if (event.type === CLIENT_EVENTS.SUBMIT_NICE_ROUND_CLUE) {
        return submitClue(room, event.playerId, event.payload, titlesByTheme, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.SUBMIT_NICE_ROUND_TITLE_GUESS) {
        return submitTitleGuess(room, event.playerId, event.payload, titlesByTheme, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.SUBMIT_NICE_ROUND_BEST_CLUE) {
        return submitBestCluePick(room, event.playerId, event.payload, titlesByTheme, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_ROUND) {
        return advanceToNextRound(room, event.playerId, titlesByTheme, onStateChange);
      }

      return { error: "That action is not supported for this minigame." };
    },
    buildClientState,
  };
}
