import { CLIENT_EVENTS, GAME_PHASES, GAME_TYPE } from "shared";

const TIE_THRESHOLD = 0.1;
const PROMPTS_PER_CONTINENT = 3;

const CONTINENT_ORDER = [
  "NorthAmerica",
  "SouthAmerica",
  "Europe",
  "Asia",
  "MiddleEast",
  "Oceania",
];

const CONTINENT_VIEWS = {
  NorthAmerica: {
    label: "North America",
    center: [15, -95],
    zoom: 3,
    maxBounds: [
      [-5, -170],
      [75, -35],
    ],
  },
  SouthAmerica: {
    label: "South America",
    center: [-15, -60],
    zoom: 3,
    maxBounds: [
      [-60, -95],
      [20, -30],
    ],
  },
  Europe: {
    label: "Europe",
    center: [54, 15],
    zoom: 4,
    maxBounds: [
      [34, -25],
      [72, 45],
    ],
  },
  Asia: {
    label: "Asia",
    center: [35, 100],
    zoom: 3,
    maxBounds: [
      [-15, 40],
      [55, 155],
    ],
  },
  MiddleEast: {
    label: "Middle East",
    center: [28, 45],
    zoom: 4,
    maxBounds: [
      [10, 25],
      [42, 65],
    ],
  },
  Oceania: {
    label: "Oceania",
    center: [-22, 145],
    zoom: 3,
    maxBounds: [
      [-50, 105],
      [5, 185],
    ],
  },
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
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

function getConnectedPlayerIds(room) {
  return room.players.filter((player) => player.connected).map((player) => player.id);
}

function normalizeContinentsBank(rawQuestions) {
  const continents = rawQuestions?.continents;
  if (!continents || typeof continents !== "object") {
    return { error: "Where is Kazakhstan? question data is missing `continents`." };
  }

  const bank = {};
  for (const continentKey of CONTINENT_ORDER) {
    const locations = continents[continentKey];
    if (!Array.isArray(locations) || locations.length === 0) {
      continue;
    }

    const normalizedLocations = locations
      .map((location) => ({
        clue: String(location.clue || location.name || "").trim(),
        answerName: String(location.answerName || location.answer || "").trim(),
        lat: Number(location.lat),
        lon: Number(location.lon),
      }))
      .filter(
        (location) =>
          location.clue && location.answerName && Number.isFinite(location.lat) && Number.isFinite(location.lon),
      );

    if (normalizedLocations.length) {
      bank[continentKey] = normalizedLocations;
    }
  }

  if (!Object.keys(bank).length) {
    return { error: "Where is Kazakhstan? has no valid continent locations configured." };
  }

  return { bank };
}

function pickPromptsForContinent(locations, count) {
  if (locations.length < count) {
    return null;
  }

  const copy = [...locations];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy.slice(0, count);
}

function startGame(room, questions, onStateChange) {
  const playerIds = getConnectedPlayerIds(room);
  if (playerIds.length < 2) {
    return { error: "Where is Kazakhstan? needs at least 2 connected players." };
  }

  const bankResult = normalizeContinentsBank(questions);
  if (bankResult.error) {
    return { error: bankResult.error };
  }

  const continentsWithEnoughClues = CONTINENT_ORDER.filter(
    (key) => (bankResult.bank[key]?.length || 0) >= PROMPTS_PER_CONTINENT,
  );

  if (!continentsWithEnoughClues.length) {
    return {
      error: `Where is Kazakhstan? needs at least one continent with ${PROMPTS_PER_CONTINENT} or more locations.`,
    };
  }

  const chosenContinentKey =
    continentsWithEnoughClues[Math.floor(Math.random() * continentsWithEnoughClues.length)];

  room.game = {
    type: GAME_TYPE.WHERE_IS_KAZAKHSTAN,
    phase: GAME_PHASES.MAP_PLACING,
    roundNumber: 0,
    continentTripNumber: 0,
    scores: Object.fromEntries(room.players.map((player) => [player.id, 0])),
    bank: bankResult.bank,
    chosenContinentKey,
    currentRound: null,
  };

  advanceRound(room, onStateChange);
  return { ok: true };
}

function advanceRound(room, onStateChange) {
  const game = room.game;
  if (!game) {
    return;
  }

  const continentKey = game.chosenContinentKey;
  if (!continentKey) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  const locations = game.bank[continentKey] || [];
  const prompts = pickPromptsForContinent(locations, PROMPTS_PER_CONTINENT);
  if (!prompts) {
    game.phase = GAME_PHASES.FINISHED;
    game.currentRound = null;
    onStateChange();
    return;
  }

  const view = CONTINENT_VIEWS[continentKey];

  game.continentTripNumber += 1;
  game.roundNumber += 1;
  game.phase = GAME_PHASES.MAP_PLACING;
  game.currentRound = {
    continentKey,
    continentLabel: view?.label || continentKey,
    mapView: view || {
      label: continentKey,
      center: [0, 0],
      zoom: 2,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
    },
    promptTotal: PROMPTS_PER_CONTINENT,
    promptIndex: 0,
    prompts,
    clue: prompts[0].clue,
    answerName: prompts[0].answerName,
    correctLat: Number(prompts[0].lat),
    correctLon: Number(prompts[0].lon),
    guesses: {},
    distancesKm: {},
    revealSteps: [],
    revealIndex: 0,
    winners: [],
    bestDistanceKm: null,
  };

  onStateChange();
}

function startNextPrompt(room, onStateChange) {
  const game = room.game;
  const round = game.currentRound;

  if (!round) {
    return { error: "No active round found." };
  }

  if (round.promptIndex >= round.promptTotal - 1) {
    return { error: "This continent round is already complete." };
  }

  round.promptIndex += 1;
  const prompt = round.prompts[round.promptIndex];

  round.clue = prompt.clue;
  round.answerName = prompt.answerName;
  round.correctLat = Number(prompt.lat);
  round.correctLon = Number(prompt.lon);
  round.guesses = {};
  round.distancesKm = {};
  round.revealSteps = [];
  round.revealIndex = 0;
  round.winners = [];
  round.bestDistanceKm = null;
  game.phase = GAME_PHASES.MAP_PLACING;

  onStateChange();
  return { ok: true };
}

function submitMapGuess(room, playerId, payload, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.MAP_PLACING) {
    return { error: "The game is not accepting map guesses right now." };
  }

  const lat = Number(payload.lat);
  const lon = Number(payload.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: "Pick a valid point on the map." };
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { error: "That map point is out of range." };
  }

  const expectedPlayers = getConnectedPlayerIds(room);
  if (!expectedPlayers.includes(playerId)) {
    return { error: "Only connected players can submit a guess." };
  }

  if (game.currentRound.guesses[playerId]) {
    return { error: "You already submitted a guess for this round." };
  }

  game.currentRound.guesses[playerId] = { lat, lon };

  const allSubmitted = expectedPlayers.every((id) => game.currentRound.guesses[id]);
  if (!allSubmitted) {
    onStateChange();
    return { ok: true };
  }

  const correctLat = game.currentRound.correctLat;
  const correctLon = game.currentRound.correctLon;

  const results = expectedPlayers.map((id) => {
    const guess = game.currentRound.guesses[id];
    const distanceKm = haversineKm(guess.lat, guess.lon, correctLat, correctLon);
    game.currentRound.distancesKm[id] = distanceKm;

    return { playerId: id, distanceKm };
  });

  const bestDistanceKm = Math.min(...results.map((entry) => entry.distanceKm));
  game.currentRound.bestDistanceKm = bestDistanceKm;

  const winners = results
    .filter((entry) => entry.distanceKm <= bestDistanceKm * (1 + TIE_THRESHOLD))
    .map((entry) => entry.playerId);

  game.currentRound.winners = winners;

  const playersByName = Object.fromEntries(room.players.map((player) => [player.id, player.name]));

  const revealPlayers = [...results].sort((left, right) => right.distanceKm - left.distanceKm);
  const revealSteps = [
    ...revealPlayers.map((entry) => ({
      type: "player",
      playerId: entry.playerId,
      playerName: playersByName[entry.playerId] || "Unknown",
      lat: game.currentRound.guesses[entry.playerId].lat,
      lon: game.currentRound.guesses[entry.playerId].lon,
      distanceKm: entry.distanceKm,
    })),
    {
      type: "correct",
      locationName: game.currentRound.answerName,
      lat: correctLat,
      lon: correctLon,
    },
  ];

  game.currentRound.revealSteps = revealSteps;
  game.currentRound.revealIndex = 0;
  game.phase = GAME_PHASES.MAP_REVEAL;

  onStateChange();
  return { ok: true };
}

function advanceRevealStep(room, playerId, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.MAP_REVEAL) {
    return { error: "There is nothing to reveal right now." };
  }

  if (room.hostId !== playerId) {
    return { error: "Only the host can advance the reveal." };
  }

  const steps = game.currentRound.revealSteps;
  if (!steps.length) {
    return { error: "Reveal sequence is missing." };
  }

  if (game.currentRound.revealIndex >= steps.length - 1) {
    return { error: "Reveal is already complete." };
  }

  game.currentRound.revealIndex += 1;
  const currentStep = steps[game.currentRound.revealIndex];

  if (currentStep.type === "correct") {
    awardPoints(room, game.currentRound.winners, 1);
    game.phase = GAME_PHASES.MAP_SCORING;
  }

  onStateChange();
  return { ok: true };
}

function advanceMapRound(room, playerId, onStateChange) {
  const game = room.game;
  if (!game || game.phase !== GAME_PHASES.MAP_SCORING) {
    return { error: "The round cannot advance right now." };
  }

  if (room.hostId !== playerId) {
    return { error: "Only the host can start the next round." };
  }

  if (game.currentRound.promptIndex < game.currentRound.promptTotal - 1) {
    return startNextPrompt(room, onStateChange);
  }

  game.phase = GAME_PHASES.FINISHED;
  game.currentRound = null;
  onStateChange();
  return { ok: true };
}

function buildClientState(room, { playerId }) {
  const game = room.game;
  const currentRound = game.currentRound;

  return {
    type: game.type,
    phase: game.phase,
    roundNumber: game.roundNumber,
    scoreboard: buildScoreboard(room),
    currentRound: currentRound
      ? {
          continentKey: currentRound.continentKey,
          continentLabel: currentRound.continentLabel,
          continentTripNumber: game.continentTripNumber,
          mapView: currentRound.mapView,
          promptIndex: currentRound.promptIndex,
          promptTotal: currentRound.promptTotal,
          clue: currentRound.clue,
          answerName: game.phase === GAME_PHASES.MAP_SCORING ? currentRound.answerName : null,
          hasSubmittedGuess: Boolean(currentRound.guesses[playerId]),
          submittedCount: Object.keys(currentRound.guesses).length,
          expectedCount: getConnectedPlayerIds(room).length,
          revealSteps: currentRound.revealSteps,
          revealIndex: currentRound.revealIndex,
          winners: game.phase === GAME_PHASES.MAP_SCORING ? currentRound.winners : [],
          distancesKm: game.phase === GAME_PHASES.MAP_SCORING ? currentRound.distancesKm : {},
          bestDistanceKm: game.phase === GAME_PHASES.MAP_SCORING ? currentRound.bestDistanceKm : null,
        }
      : null,
  };
}

export function createWhereIsKazakhstanMinigame({ questions }) {
  return {
    type: GAME_TYPE.WHERE_IS_KAZAKHSTAN,
    name: "Where is Kazakhstan?",
    description:
      "One random continent per game, with 3 clue-style prompts in a row. Drop a pin on the map; closest guess wins the point (ties within 10% of best).",
    start(room, { onStateChange }) {
      return startGame(room, questions, onStateChange);
    },
    handleEvent(room, event, { onStateChange }) {
      if (event.type === CLIENT_EVENTS.SUBMIT_MAP_GUESS) {
        return submitMapGuess(room, event.playerId, event.payload, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_MAP_REVEAL_STEP) {
        return advanceRevealStep(room, event.playerId, onStateChange);
      }

      if (event.type === CLIENT_EVENTS.NEXT_MAP_ROUND) {
        return advanceMapRound(room, event.playerId, onStateChange);
      }

      return { error: "That action is not supported for this minigame." };
    },
    buildClientState,
  };
}
