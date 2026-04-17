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

function pickUniqueTitles(pool, count) {
  if (pool.length < count) {
    return null;
  }

  return shuffle([...pool]).slice(0, count);
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

function isMostlyEmojiString(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed.length > 200) {
    return false;
  }

  if (!/\p{Extended_Pictographic}/u.test(trimmed)) {
    return false;
  }

  if (/\p{L}{5,}/u.test(trimmed) || /\p{N}{6,}/u.test(trimmed)) {
    return false;
  }

  const nonSpace = trimmed.replace(/\s+/g, "");
  const asciiWordChars = (nonSpace.match(/[A-Za-z0-9]/g) || []).length;
  if (nonSpace.length === 0) {
    return false;
  }

  return asciiWordChars / nonSpace.length <= 0.35;
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
  const titles = pickUniqueTitles(pool, participantIds.length);
  if (!titles) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  game.roundNumber += 1;
  game.phase = GAME_PHASES.TOTES_EMOJI_ENTRY;

  const shuffledPlayers = shuffle([...participantIds]);
  const assignments = Object.fromEntries(
    shuffledPlayers.map((playerId, index) => [playerId, titles[index]]),
  );

  const guessOrder = shuffle([...participantIds]);
  const targets = derangedTargets(guessOrder);
  if (!targets) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  const guessSequence = guessOrder.map((guesserId, index) => ({
    guesserId,
    targetId: targets[index],
  }));

  game.currentRound = {
    theme,
    themeLabel: THEME_LABELS[theme] || theme,
    participantIds,
    assignments,
    emojis: {},
    guessSequence,
    currentGuessIndex: 0,
    guessLog: [],
    titleOptions: [...pool].sort((a, b) => a.localeCompare(b)),
    titleRerollsUsed: {},
  };

  onStateChange();
}

function rerollMyTitle(room, playerId, titleBank, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.TOTES_EMOJI_ENTRY) {
    return { error: "You can only re-roll your title during the emoji clue phase." };
  }

  const round = game.currentRound;
  if (!round.participantIds.includes(playerId)) {
    return { error: "You are not in this round." };
  }

  if (round.emojis[playerId]) {
    return { error: "You already submitted your emoji clue." };
  }

  if (round.titleRerollsUsed[playerId]) {
    return { error: "You already used your re-roll for this round." };
  }

  const pool = titleBank[round.theme] || [];
  const mine = round.assignments[playerId];
  if (!mine) {
    return { error: "You do not have a title to re-roll." };
  }

  const usedByOthers = new Set(
    round.participantIds.filter((id) => id !== playerId).map((id) => round.assignments[id]),
  );

  const available = pool.filter((title) => !usedByOthers.has(title) && title !== mine);
  if (!available.length) {
    return { error: "No other title is available to switch to." };
  }

  const nextTitle = available[Math.floor(Math.random() * available.length)];
  round.assignments[playerId] = nextTitle;
  round.titleRerollsUsed[playerId] = true;

  onStateChange();
  return { ok: true };
}

function startGame(room, titleBank, onStateChange) {
  const participantIds = getConnectedPlayerIds(room);
  if (participantIds.length < 2) {
    return { error: "Totes Emoji needs at least 2 connected players." };
  }

  room.game = {
    type: GAME_TYPE.TOTES_EMOJI,
    phase: GAME_PHASES.LOBBY,
    roundNumber: 0,
    scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
    currentRound: null,
  };

  advanceRound(room, titleBank, onStateChange);
  return { ok: true };
}

function submitEmojiClue(room, playerId, payload, titleBank, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.TOTES_EMOJI_ENTRY) {
    return { error: "The game is not collecting emoji clues right now." };
  }

  const round = game.currentRound;
  if (!round.participantIds.includes(playerId)) {
    return { error: "You are not in this round." };
  }

  const raw = String(payload?.emoji ?? payload?.clue ?? "").trim();
  if (!raw) {
    return { error: "Enter at least one emoji." };
  }

  if (!isMostlyEmojiString(raw)) {
    return { error: "Use mostly emoji for your clue (letters and numbers are not allowed)." };
  }

  if (round.emojis[playerId]) {
    return { error: "You already submitted your emoji clue." };
  }

  round.emojis[playerId] = raw;

  const allIn = round.participantIds.every((id) => round.emojis[id]);
  if (!allIn) {
    onStateChange();
    return { ok: true };
  }

  game.phase = GAME_PHASES.TOTES_EMOJI_GUESSING;
  round.currentGuessIndex = 0;
  onStateChange();
  return { ok: true };
}

function submitTitleGuess(room, playerId, payload, titleBank, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.TOTES_EMOJI_GUESSING) {
    return { error: "The game is not in the guessing phase right now." };
  }

  const round = game.currentRound;
  const step = round.guessSequence[round.currentGuessIndex];
  if (!step) {
    return { error: "This round has no active guess step." };
  }

  if (step.guesserId !== playerId) {
    return { error: "It is not your turn to guess." };
  }

  const guessRaw = String(payload?.title ?? "").trim();
  if (!guessRaw) {
    return { error: "Pick or type a title first." };
  }

  const answerTitle = round.assignments[step.targetId];
  const correct = normalizeTitle(guessRaw) === normalizeTitle(answerTitle);

  round.guessLog.push({
    guesserId: step.guesserId,
    targetId: step.targetId,
    guess: guessRaw,
    correct,
    answerTitle,
  });

  if (correct) {
    awardPoints(room, step.guesserId, 1);
    awardPoints(room, step.targetId, 1);
  }

  round.currentGuessIndex += 1;
  if (round.currentGuessIndex >= round.guessSequence.length) {
    game.phase = GAME_PHASES.REVEAL;
  }

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

  const base = {
    themeLabel: round.themeLabel,
    participantIds: round.participantIds,
    submittedEmojiCount: Object.keys(round.emojis).length,
    expectedEmojiCount: round.participantIds.length,
    titleOptions: round.titleOptions,
  };

  if (game.phase === GAME_PHASES.TOTES_EMOJI_ENTRY) {
    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      currentRound: {
        ...base,
        myTitle: round.assignments[playerId] || null,
        hasSubmittedEmoji: Boolean(round.emojis[playerId]),
        hasUsedTitleReroll: Boolean(round.titleRerollsUsed[playerId]),
        canRerollTitle:
          Boolean(round.assignments[playerId]) &&
          !round.emojis[playerId] &&
          !round.titleRerollsUsed[playerId],
      },
    };
  }

  if (game.phase === GAME_PHASES.TOTES_EMOJI_GUESSING) {
    const step = round.guessSequence[round.currentGuessIndex];
    const last = round.guessLog.length ? round.guessLog[round.guessLog.length - 1] : null;

    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      currentRound: {
        ...base,
        currentGuesserId: step?.guesserId || null,
        currentGuesserName: step ? playersById[step.guesserId] || "Unknown" : null,
        currentTargetId: step?.targetId || null,
        currentTargetName: step ? playersById[step.targetId] || "Unknown" : null,
        currentEmoji: step ? round.emojis[step.targetId] || "" : "",
        isMyTurnToGuess: step?.guesserId === playerId,
        guessHistory: round.guessLog.map((entry) => ({
          guesserName: playersById[entry.guesserId] || "Unknown",
          targetName: playersById[entry.targetId] || "Unknown",
          guess: entry.guess,
          correct: entry.correct,
          answerTitle: entry.answerTitle,
        })),
        lastGuess: last
          ? {
              guesserName: playersById[last.guesserId] || "Unknown",
              targetName: playersById[last.targetId] || "Unknown",
              guess: last.guess,
              correct: last.correct,
              answerTitle: last.answerTitle,
            }
          : null,
      },
    };
  }

  if (game.phase === GAME_PHASES.REVEAL) {
    const revealRows = round.participantIds.map((id) => ({
      playerId: id,
      playerName: playersById[id] || "Unknown",
      title: round.assignments[id],
      emoji: round.emojis[id] || "",
    }));

    return {
      type: game.type,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      currentRound: {
        ...base,
        revealRows,
        guessHistory: round.guessLog.map((entry) => ({
          guesserName: playersById[entry.guesserId] || "Unknown",
          targetName: playersById[entry.targetId] || "Unknown",
          guess: entry.guess,
          correct: entry.correct,
          answerTitle: entry.answerTitle,
        })),
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

export function createTotesEmojiMinigame({ titlesByTheme }) {
  return {
    type: GAME_TYPE.TOTES_EMOJI,
    name: "Totes Emoji",
    description:
      "Describe a random TV show, movie, or book using only emoji, then guess what everyone else's emoji mean.",
    start(room, { onStateChange }) {
      return startGame(room, titlesByTheme, onStateChange);
    },
    handleEvent(room, event, { onStateChange }) {
      if (event.type === CLIENT_EVENTS.SUBMIT_TOTES_EMOJI_CLUE) {
        return submitEmojiClue(room, event.playerId, event.payload, titlesByTheme, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.SUBMIT_TOTES_EMOJI_TITLE_GUESS) {
        return submitTitleGuess(room, event.playerId, event.payload, titlesByTheme, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.REROLL_TOTES_EMOJI_TITLE) {
        return rerollMyTitle(room, event.playerId, titlesByTheme, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_ROUND) {
        return advanceToNextRound(room, event.playerId, titlesByTheme, onStateChange);
      }

      return { error: "That action is not supported for this minigame." };
    },
    buildClientState,
  };
}
