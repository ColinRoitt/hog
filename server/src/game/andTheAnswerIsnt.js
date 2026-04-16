import { CLIENT_EVENTS, GAME_PHASES, GAME_TYPE } from "shared";

const GUESSED_CORRECT_POINTS = 2;
const SUCCESSFUL_BLUFF_POINTS = 1;

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function pickQuestion(questions, usedQuestionIndexes) {
  const available = questions
    .map((question, index) => ({ question, index }))
    .filter(({ index }) => !usedQuestionIndexes.includes(index));

  if (available.length === 0) {
    return null;
  }

  return available[Math.floor(Math.random() * available.length)];
}

function startGame(room, questions, onStateChange) {
  const activePlayers = room.players.filter((player) => player.connected);

  if (activePlayers.length < 3) {
    return { error: "At least 3 connected players are needed to start." };
  }

  room.game = {
    type: GAME_TYPE.AND_THE_ANSWER_ISNT,
    phase: GAME_PHASES.LOBBY,
    roundNumber: 0,
    turnOrder: activePlayers.map((player) => player.id),
    currentGuesserIndex: -1,
    scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
    usedQuestionIndexes: [],
    currentRound: null,
  };

  advanceRound(room, questions, onStateChange);
  return { ok: true };
}

function submitFakeAnswer(room, playerId, answer, questions, onStateChange) {
  const game = room.game;

  if (!game || game.phase !== GAME_PHASES.COLLECTING_FAKE_ANSWERS) {
    return { error: "The game is not waiting for fake answers right now." };
  }

  if (game.currentRound.guesserId === playerId) {
    return { error: "The guesser cannot submit a fake answer." };
  }

  const trimmedAnswer = answer.trim();
  if (!trimmedAnswer) {
    return { error: "Enter a fake answer first." };
  }

  game.currentRound.fakeAnswers[playerId] = trimmedAnswer;

  const expectedSubmitters = room.players
    .filter((player) => player.connected && player.id !== game.currentRound.guesserId)
    .map((player) => player.id);

  const hasAllAnswers = expectedSubmitters.every(
    (submitterId) => game.currentRound.fakeAnswers[submitterId],
  );

  if (hasAllAnswers) {
    game.phase = GAME_PHASES.GUESSING;
    game.currentRound.options = shuffle([
      ...Object.entries(game.currentRound.fakeAnswers).map(([ownerId, text], index) => ({
        id: `fake-${index}-${ownerId}`,
        text,
        isCorrect: false,
        ownerId,
      })),
      {
        id: "correct-answer",
        text: game.currentRound.correctAnswer,
        isCorrect: true,
        ownerId: null,
      },
    ]);
  }

  onStateChange();
  return { ok: true };
}

function submitGuess(room, playerId, optionId, questions, onStateChange) {
  const game = room.game;

  if (!game || game.phase !== GAME_PHASES.GUESSING) {
    return { error: "The game is not waiting for a guess right now." };
  }

  if (game.currentRound.guesserId !== playerId) {
    return { error: "Only the active guesser can make a guess." };
  }

  const choice = game.currentRound.options.find((option) => option.id === optionId);
  if (!choice) {
    return { error: "That answer option does not exist." };
  }

  game.currentRound.selectedOptionId = optionId;
  game.currentRound.guessedCorrectly = choice.isCorrect;

  if (choice.isCorrect) {
    awardPoints(room, playerId, GUESSED_CORRECT_POINTS);
  } else if (choice.ownerId) {
    awardPoints(room, choice.ownerId, SUCCESSFUL_BLUFF_POINTS);
  }

  game.phase = GAME_PHASES.REVEAL;
  onStateChange();

  return { ok: true };
}

function awardPoints(room, playerId, points) {
  room.game.scores[playerId] = (room.game.scores[playerId] || 0) + points;

  const player = room.players.find((entry) => entry.id === playerId);
  if (player) {
    player.totalPoints = (player.totalPoints || 0) + points;
  }
}

function advanceToNextRound(room, playerId, questions, onStateChange) {
  const game = room.game;

  if (!game || game.phase !== GAME_PHASES.REVEAL) {
    return { error: "The round cannot advance right now." };
  }

  if (game.currentRound?.guesserId !== playerId) {
    return { error: "Only the active guesser can move to the next round." };
  }

  advanceRound(room, questions, onStateChange);
  return { ok: true };
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

  game.currentGuesserIndex += 1;

  if (game.currentGuesserIndex >= game.turnOrder.length) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
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
  game.currentRound = {
    question: pickedQuestion.question.question,
    correctAnswer: pickedQuestion.question.answer,
    guesserId: game.turnOrder[game.currentGuesserIndex],
    fakeAnswers: {},
    options: [],
    selectedOptionId: null,
    guessedCorrectly: false,
  };

  onStateChange();
}

function buildClientState(room, { playerId }) {
  const currentRound = room.game?.currentRound;
  const guesserId = currentRound?.guesserId || null;
  const playerNamesById = Object.fromEntries(room.players.map((player) => [player.id, player.name]));

  return {
    type: room.game.type,
    phase: room.game.phase,
    roundNumber: room.game.roundNumber,
    scoreboard: buildScoreboard(room),
    currentRound: currentRound
      ? {
          question: currentRound.question,
          guesserId,
          guesserName: playerNamesById[guesserId] || "Unknown",
          isGuesser: guesserId === playerId,
          answerOptions:
            room.game.phase === GAME_PHASES.GUESSING || room.game.phase === GAME_PHASES.REVEAL
              ? currentRound.options.map((option) => ({
                  id: option.id,
                  text: option.text,
                  isCorrect: room.game.phase === GAME_PHASES.REVEAL ? option.isCorrect : undefined,
                  ownerName:
                    room.game.phase === GAME_PHASES.REVEAL
                      ? option.ownerId
                        ? playerNamesById[option.ownerId] || "Unknown"
                        : "Correct answer"
                      : null,
                }))
              : [],
          fakeAnswersSubmittedCount: Object.keys(currentRound.fakeAnswers).length,
          fakeAnswersExpectedCount: room.players.filter(
            (player) => player.connected && player.id !== guesserId,
          ).length,
          hasSubmittedFakeAnswer: Boolean(currentRound.fakeAnswers[playerId]),
          selectedOptionId: currentRound.selectedOptionId,
          guessedCorrectly: room.game.phase === GAME_PHASES.REVEAL ? currentRound.guessedCorrectly : null,
          correctAnswer: room.game.phase === GAME_PHASES.REVEAL ? currentRound.correctAnswer : null,
        }
      : null,
  };
}

export function createAndTheAnswerIsntMinigame({ questions }) {
  return {
    type: GAME_TYPE.AND_THE_ANSWER_ISNT,
    name: "And the Answer Isn't",
    description: "One player guesses the real answer while everyone else submits bluffs.",
    start(room, { onStateChange }) {
      return startGame(room, questions, onStateChange);
    },
    handleEvent(room, event, { onStateChange }) {
      if (event.type === CLIENT_EVENTS.SUBMIT_FAKE_ANSWER) {
        return submitFakeAnswer(room, event.playerId, event.payload.answer || "", questions, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.SUBMIT_GUESS) {
        return submitGuess(room, event.playerId, event.payload.optionId, questions, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_ROUND) {
        return advanceToNextRound(room, event.playerId, questions, onStateChange);
      }

      return { error: "That action is not supported for this minigame." };
    },
    buildClientState,
  };
}
