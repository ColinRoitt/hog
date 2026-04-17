import { CLIENT_EVENTS, GAME_PHASES, GAME_TYPE } from "shared";
import { pendingSubmitNamesFromExpected } from "./submissionWaitHelpers.js";

function pickQuestion(questions, usedQuestionIndexes) {
  const available = questions
    .map((question, index) => ({ question, index }))
    .filter(({ index }) => !usedQuestionIndexes.includes(index));

  if (available.length === 0) {
    return null;
  }

  return available[Math.floor(Math.random() * available.length)];
}

function getConnectedPlayerIds(room) {
  return room.players.filter((player) => player.connected).map((player) => player.id);
}

function awardPoints(room, playerIds, points) {
  playerIds.forEach((playerId) => {
    room.game.scores[playerId] = (room.game.scores[playerId] || 0) + points;

    const player = room.players.find((entry) => entry.id === playerId);
    if (player) {
      player.totalPoints = (player.totalPoints || 0) + points;
    }
  });
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

function advanceRound(room, questions, onStateChange) {
  const game = room.game;
  if (!game) {
    return;
  }

  const pickedQuestion = pickQuestion(questions, game.usedQuestionIndexes);
  if (!pickedQuestion) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  game.roundNumber += 1;
  game.usedQuestionIndexes.push(pickedQuestion.index);
  game.phase = GAME_PHASES.COLLECTING_FAKE_ANSWERS;

  const rawAnswer = pickedQuestion.question.answer;
  const correctAnswer = typeof rawAnswer === "number" ? rawAnswer : Number(rawAnswer);

  game.currentRound = {
    question: pickedQuestion.question.question,
    correctAnswer,
    guesses: {},
    revealRows: null,
    winners: [],
  };

  onStateChange();
}

function startGame(room, questions, onStateChange) {
  const playerIds = getConnectedPlayerIds(room);
  if (playerIds.length < 2) {
    return { error: "I'm Terrible at Dating needs at least 2 connected players." };
  }

  room.game = {
    type: GAME_TYPE.IM_TERRIBLE_AT_DATING,
    phase: GAME_PHASES.LOBBY,
    roundNumber: 0,
    scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
    usedQuestionIndexes: [],
    currentRound: null,
  };

  advanceRound(room, questions, onStateChange);
  return { ok: true };
}

function submitGuess(room, playerId, payload, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.COLLECTING_FAKE_ANSWERS) {
    return { error: "The game is not accepting guesses right now." };
  }

  const parsedGuess = Number(payload?.guess);
  if (!Number.isFinite(parsedGuess)) {
    return { error: "Enter a valid year as a number." };
  }

  const expectedPlayers = getConnectedPlayerIds(room);
  if (!expectedPlayers.includes(playerId)) {
    return { error: "Only connected players can submit a guess." };
  }

  if (game.currentRound.guesses[playerId]) {
    return { error: "You already submitted a guess for this round." };
  }

  game.currentRound.guesses[playerId] = parsedGuess;

  const allSubmitted = expectedPlayers.every((id) => game.currentRound.guesses[id]);
  if (!allSubmitted) {
    onStateChange();
    return { ok: true };
  }

  const correct = game.currentRound.correctAnswer;
  const results = expectedPlayers.map((id) => {
    const guess = game.currentRound.guesses[id];
    return {
      playerId: id,
      guess,
      distance: Math.abs(guess - correct),
    };
  });

  const bestDistance = Math.min(...results.map((entry) => entry.distance));
  const winners = results.filter((entry) => entry.distance === bestDistance).map((entry) => entry.playerId);

  game.currentRound.revealRows = results;
  game.currentRound.winners = winners;
  awardPoints(room, winners, 1);
  game.phase = GAME_PHASES.REVEAL;

  onStateChange();
  return { ok: true };
}

function advanceToNextRound(room, playerId, questions, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.REVEAL) {
    return { error: "The round cannot advance right now." };
  }

  if (room.hostId !== playerId) {
    return { error: "Only the host can move to the next round." };
  }

  advanceRound(room, questions, onStateChange);
  return { ok: true };
}

function buildClientState(room, { playerId }) {
  const game = room.game;
  const currentRound = game.currentRound;
  const playersById = Object.fromEntries(room.players.map((player) => [player.id, player.name]));
  const expectedPlayerIds = getConnectedPlayerIds(room);
  const expectedCount = expectedPlayerIds.length;
  const pendingSubmitNames = pendingSubmitNamesFromExpected(
    room,
    expectedPlayerIds,
    (id) => Boolean(currentRound.guesses[id]),
  );

  return {
    type: game.type,
    phase: game.phase,
    roundNumber: game.roundNumber,
    scoreboard: buildScoreboard(room),
    currentRound: currentRound
      ? {
          question: currentRound.question,
          hasSubmittedGuess: Boolean(currentRound.guesses[playerId]),
          submittedCount: Object.keys(currentRound.guesses).length,
          expectedCount,
          pendingSubmitNames,
          correctAnswer: game.phase === GAME_PHASES.REVEAL ? currentRound.correctAnswer : null,
          revealRows:
            game.phase === GAME_PHASES.REVEAL && currentRound.revealRows
              ? currentRound.revealRows.map((row) => ({
                  playerId: row.playerId,
                  playerName: playersById[row.playerId] || "Unknown",
                  guess: row.guess,
                  distance: row.distance,
                }))
              : [],
          winners: game.phase === GAME_PHASES.REVEAL ? currentRound.winners : [],
        }
      : null,
  };
}

export function createImTerribleAtDatingMinigame({ questions }) {
  return {
    type: GAME_TYPE.IM_TERRIBLE_AT_DATING,
    name: "I'm Terrible at Dating",
    description:
      "Guess when each event happened. Closest year wins the point (BC answers are negative numbers).",
    start(room, { onStateChange }) {
      return startGame(room, questions, onStateChange);
    },
    handleEvent(room, event, { onStateChange }) {
      if (event.type === CLIENT_EVENTS.SUBMIT_IM_TERRIBLE_AT_DATING_GUESS) {
        return submitGuess(room, event.playerId, event.payload, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_ROUND) {
        return advanceToNextRound(room, event.playerId, questions, onStateChange);
      }

      return { error: "That action is not supported for this minigame." };
    },
    buildClientState,
  };
}
