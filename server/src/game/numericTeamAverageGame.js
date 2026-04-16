import { CLIENT_EVENTS, GAME_PHASES } from "shared";

function pickQuestion(questions, usedQuestionIndexes) {
  const available = questions
    .map((question, index) => ({ question, index }))
    .filter(({ index }) => !usedQuestionIndexes.includes(index));

  if (available.length === 0) {
    return null;
  }

  return available[Math.floor(Math.random() * available.length)];
}

function assignTeams(players) {
  const connectedPlayers = players.filter((player) => player.connected);
  const teamA = [];
  const teamB = [];

  connectedPlayers.forEach((player, index) => {
    if (index % 2 === 0) {
      teamA.push(player.id);
    } else {
      teamB.push(player.id);
    }
  });

  return { teamA, teamB };
}

function calculateAverage(numbers) {
  if (!numbers.length) {
    return null;
  }

  const total = numbers.reduce((sum, value) => sum + value, 0);
  return total / numbers.length;
}

function awardTeamPoint(room, playerIds) {
  playerIds.forEach((playerId) => {
    room.game.scores[playerId] = (room.game.scores[playerId] || 0) + 1;
    const player = room.players.find((entry) => entry.id === playerId);
    if (player) {
      player.totalPoints = (player.totalPoints || 0) + 1;
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

function getTeamsWithNames(room, teams) {
  const playersById = Object.fromEntries(room.players.map((player) => [player.id, player]));

  return {
    teamA: teams.teamA.map((playerId) => ({
      id: playerId,
      name: playersById[playerId]?.name || "Unknown",
    })),
    teamB: teams.teamB.map((playerId) => ({
      id: playerId,
      name: playersById[playerId]?.name || "Unknown",
    })),
  };
}

export function createNumericTeamAverageMinigame({
  questions,
  gameType,
  name,
  description,
  minPlayers = 4,
}) {
  function advanceRound(room, onStateChange) {
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
      teamAAverage: null,
      teamBAverage: null,
      winningTeams: [],
    };

    onStateChange();
  }

  function startGame(room, onStateChange) {
    const connectedPlayers = room.players.filter((player) => player.connected);
    if (connectedPlayers.length < minPlayers) {
      return { error: `${name} needs at least ${minPlayers} connected players.` };
    }

    const teams = assignTeams(room.players);
    room.game = {
      type: gameType,
      phase: GAME_PHASES.LOBBY,
      roundNumber: 0,
      scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
      usedQuestionIndexes: [],
      teams,
      currentRound: null,
    };

    advanceRound(room, onStateChange);
    return { ok: true };
  }

  function submitGuess(room, playerId, guess, onStateChange) {
    const game = room.game;
    if (!game || game.phase !== GAME_PHASES.COLLECTING_FAKE_ANSWERS) {
      return { error: "The game is not accepting guesses right now." };
    }

    const parsedGuess = Number(guess);
    if (!Number.isFinite(parsedGuess)) {
      return { error: "Enter a valid number." };
    }

    const isPlaying = game.teams.teamA.includes(playerId) || game.teams.teamB.includes(playerId);
    if (!isPlaying) {
      return { error: "You are not assigned to an active team this game." };
    }

    game.currentRound.guesses[playerId] = parsedGuess;

    const activePlayerIds = [...game.teams.teamA, ...game.teams.teamB];
    const allSubmitted = activePlayerIds.every((id) =>
      Object.prototype.hasOwnProperty.call(game.currentRound.guesses, id),
    );

    if (allSubmitted) {
      const teamAGuesses = game.teams.teamA.map((id) => game.currentRound.guesses[id]);
      const teamBGuesses = game.teams.teamB.map((id) => game.currentRound.guesses[id]);

      const teamAAverage = calculateAverage(teamAGuesses);
      const teamBAverage = calculateAverage(teamBGuesses);
      const correct = game.currentRound.correctAnswer;
      const teamADistance = Math.abs(teamAAverage - correct);
      const teamBDistance = Math.abs(teamBAverage - correct);

      game.currentRound.teamAAverage = teamAAverage;
      game.currentRound.teamBAverage = teamBAverage;

      if (teamADistance < teamBDistance) {
        game.currentRound.winningTeams = ["A"];
        awardTeamPoint(room, game.teams.teamA);
      } else if (teamBDistance < teamADistance) {
        game.currentRound.winningTeams = ["B"];
        awardTeamPoint(room, game.teams.teamB);
      } else {
        game.currentRound.winningTeams = ["A", "B"];
        awardTeamPoint(room, game.teams.teamA);
        awardTeamPoint(room, game.teams.teamB);
      }

      game.phase = GAME_PHASES.REVEAL;
    }

    onStateChange();
    return { ok: true };
  }

  function advanceToNextRound(room, playerId, onStateChange) {
    const game = room.game;
    if (!game || game.phase !== GAME_PHASES.REVEAL) {
      return { error: "The round cannot advance right now." };
    }

    if (room.hostId !== playerId) {
      return { error: "Only the host can move to the next round." };
    }

    advanceRound(room, onStateChange);
    return { ok: true };
  }

  function buildClientState(room, { playerId }) {
    const game = room.game;
    const teamsWithNames = getTeamsWithNames(room, game.teams);
    const isPlayerOnTeamA = game.teams.teamA.includes(playerId);
    const isPlayerOnTeamB = game.teams.teamB.includes(playerId);
    const activeTeam = isPlayerOnTeamA ? "A" : isPlayerOnTeamB ? "B" : null;
    const currentRound = game.currentRound;
    const guessEntries = currentRound?.guesses || {};

    return {
      type: game.type,
      gameName: name,
      phase: game.phase,
      roundNumber: game.roundNumber,
      scoreboard: buildScoreboard(room),
      teams: teamsWithNames,
      activeTeam,
      currentRound: currentRound
        ? {
            question: currentRound.question,
            hasSubmittedGuess: Object.prototype.hasOwnProperty.call(guessEntries, playerId),
            submittedCount: Object.keys(guessEntries).length,
            expectedCount: game.teams.teamA.length + game.teams.teamB.length,
            teamAGuesses:
              game.phase === GAME_PHASES.REVEAL
                ? game.teams.teamA.map((id) => ({
                    playerName: teamsWithNames.teamA.find((player) => player.id === id)?.name || "Unknown",
                    guess: guessEntries[id],
                  }))
                : [],
            teamBGuesses:
              game.phase === GAME_PHASES.REVEAL
                ? game.teams.teamB.map((id) => ({
                    playerName: teamsWithNames.teamB.find((player) => player.id === id)?.name || "Unknown",
                    guess: guessEntries[id],
                  }))
                : [],
            teamAAverage: game.phase === GAME_PHASES.REVEAL ? currentRound.teamAAverage : null,
            teamBAverage: game.phase === GAME_PHASES.REVEAL ? currentRound.teamBAverage : null,
            correctAnswer: game.phase === GAME_PHASES.REVEAL ? currentRound.correctAnswer : null,
            winningTeams: game.phase === GAME_PHASES.REVEAL ? currentRound.winningTeams : [],
          }
        : null,
    };
  }

  return {
    type: gameType,
    name,
    description,
    start(room, { onStateChange }) {
      return startGame(room, onStateChange);
    },
    handleEvent(room, event, { onStateChange }) {
      if (event.type === CLIENT_EVENTS.SUBMIT_DISTINCTLY_AVERAGE_GUESS) {
        return submitGuess(room, event.playerId, event.payload.guess, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_ROUND) {
        return advanceToNextRound(room, event.playerId, onStateChange);
      }

      return { error: "That action is not supported for this minigame." };
    },
    buildClientState,
  };
}
