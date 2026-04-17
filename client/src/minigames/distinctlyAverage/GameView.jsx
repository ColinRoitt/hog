import { useEffect, useMemo, useState } from "react";
import { GAME_PHASES } from "shared";

function TeamCard({ title, players, average, winningTeams, teamKey, revealIndexMap, revealedCount }) {
  const isWinner = winningTeams.includes(teamKey);
  const revealedGuesses = players
    .filter((player) => {
      const revealIndex = revealIndexMap[player.playerName];
      return typeof revealIndex === "number" && revealIndex < revealedCount;
    })
    .map((player) => Number(player.guess));
  const revealedTotal = revealedGuesses.reduce((sum, value) => sum + value, 0);
  const revealedDiff = revealedTotal - average;
  const allRevealed = players.every((player) => {
    const revealIndex = revealIndexMap[player.playerName];
    return typeof revealIndex === "number" && revealIndex < revealedCount;
  });

  return (
    <div className={`panel ${isWinner ? "team-winner" : ""}`}>
      <h3>{title}</h3>
      <ul className="score-list">
        {players.map((player) => (
          <li key={player.playerName}>
            <span>{player.playerName}</span>
            <strong>
              {revealIndexMap[player.playerName] < revealedCount ? player.guess : "?"}
            </strong>
          </li>
        ))}
      </ul>
      <div className="team-totals">
        <div className="team-total-box">
          <span className="subtle">Team difference</span>
          <strong className="team-total-value">{allRevealed ? revealedDiff : "..."}</strong>
        </div>
        <div className="team-total-box">
          <span className="subtle">Team average</span>
          <strong className="team-total-value">
            {allRevealed && average !== null ? average.toFixed(2) : "..."}
          </strong>
        </div>
      </div>
    </div>
  );
}

function Scoreboard({ scoreboard, isHost, onReturnToLobby }) {
  return (
    <div className="panel">
      <h2>Game points</h2>
      <ul className="score-list">
        {scoreboard.map((player) => (
          <li key={player.id}>
            <span>{player.name}</span>
            <strong>{player.score}</strong>
          </li>
        ))}
      </ul>
      {isHost ? (
        <button type="button" onClick={onReturnToLobby}>
          Return to lobby
        </button>
      ) : null}
    </div>
  );
}

function TeamAssignments({ teams }) {
  return (
    <div className="panel">
      <h2>Team assignments</h2>
      <p className="subtle">No conferring with your teammates before submitting your guess.</p>
      <div className="stack">
        <p className="subtle">
          <strong>Team A:</strong> {teams.teamA.map((player) => player.name).join(", ")}
        </p>
        <p className="subtle">
          <strong>Team B:</strong> {teams.teamB.map((player) => player.name).join(", ")}
        </p>
      </div>
    </div>
  );
}

export function DistinctlyAverageGameView({
  roomState,
  onSubmitDistinctlyAverageGuess,
  onNextRound,
  onReturnToLobby,
}) {
  const [guessInput, setGuessInput] = useState("");
  const [revealedCount, setRevealedCount] = useState(0);
  const game = roomState.game;
  const round = game.currentRound;
  const isHost = roomState.room.hostId === roomState.selfPlayerId;
  const revealSequence = useMemo(
    () => buildRevealSequence(round?.teamAGuesses || [], round?.teamBGuesses || []),
    [round],
  );
  const revealIndexMap = useMemo(
    () =>
      Object.fromEntries(revealSequence.map((playerName, index) => [playerName, index])),
    [revealSequence],
  );

  useEffect(() => {
    setGuessInput("");
  }, [game.roundNumber]);

  useEffect(() => {
    if (game.phase !== GAME_PHASES.REVEAL) {
      setRevealedCount(0);
      return;
    }

    setRevealedCount(1);
    const interval = window.setInterval(() => {
      setRevealedCount((count) => {
        if (count >= revealSequence.length) {
          window.clearInterval(interval);
          return count;
        }

        return count + 1;
      });
    }, 900);

    return () => {
      window.clearInterval(interval);
    };
  }, [game.phase, revealSequence]);

  if (!round && game.phase === GAME_PHASES.FINISHED) {
    return (
      <main className="shell game-layout">
        <section className="card game-main">
          <p className="eyebrow">Game complete</p>
          <h1>Distinctly Average</h1>
          <div className="panel">
            <h2>No more questions</h2>
            <p className="subtle">Game over. Return to lobby to pick another minigame.</p>
            <button type="button" onClick={onReturnToLobby} disabled={!isHost}>
              {isHost ? "Back to lobby" : "Waiting for host"}
            </button>
          </div>
        </section>
        <aside className="card game-sidebar">
          <Scoreboard
            scoreboard={game.scoreboard}
            isHost={isHost}
            onReturnToLobby={onReturnToLobby}
          />
        </aside>
      </main>
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmitDistinctlyAverageGuess(guessInput);
  }

  return (
    <main className="shell game-layout">
      <section className="card game-main">
        <p className="eyebrow">Round {game.roundNumber}</p>
        <h1>Distinctly Average</h1>
        <TeamAssignments teams={game.teams} />
        <div className="panel">
          <h2>Question</h2>
          <p className="question">{round.question}</p>
          <p className="subtle">
            Your team: {roundStateTeamLabel(game.activeTeam)}. Everyone submits an individual number.
          </p>
        </div>

        {game.phase === GAME_PHASES.COLLECTING_FAKE_ANSWERS ? (
          <form className="panel stack" onSubmit={handleSubmit}>
            <h2>Your numerical guess</h2>
            <input
              type="number"
              value={guessInput}
              onChange={(event) => setGuessInput(event.target.value)}
              placeholder="e.g. 123"
              disabled={round.hasSubmittedGuess}
            />
            <button type="submit" disabled={round.hasSubmittedGuess}>
              {round.hasSubmittedGuess ? "Submitted" : "Submit guess"}
            </button>
            <p className="subtle">
              {round.submittedCount} of {round.expectedCount} guesses in.
            </p>
          </form>
        ) : null}

        {game.phase === GAME_PHASES.REVEAL ? (
          <div className="stack">
            <div className="panel">
              <h2>Reveal</h2>
              <p className="subtle">
                Revealing guesses: {Math.min(revealedCount, revealSequence.length)} /{" "}
                {revealSequence.length}
              </p>
              <p className="subtle">Correct answer: {round.correctAnswer}</p>
              <p className="subtle">
                Winning team{round.winningTeams.length > 1 ? "s" : ""}:{" "}
                {round.winningTeams.length > 1
                  ? "Team A and Team B"
                  : round.winningTeams[0] === "A"
                    ? "Team A"
                    : "Team B"}
              </p>
            </div>

            <TeamCard
              title="Team A"
              players={round.teamAGuesses}
              average={round.teamAAverage}
              winningTeams={round.winningTeams}
              teamKey="A"
              revealIndexMap={revealIndexMap}
              revealedCount={revealedCount}
            />
            <TeamCard
              title="Team B"
              players={round.teamBGuesses}
              average={round.teamBAverage}
              winningTeams={round.winningTeams}
              teamKey="B"
              revealIndexMap={revealIndexMap}
              revealedCount={revealedCount}
            />

            <button
              type="button"
              onClick={onNextRound}
              disabled={!isHost || revealedCount < revealSequence.length}
            >
              {isHost ? "Next round" : "Waiting for host"}
            </button>
          </div>
        ) : null}
      </section>

      <aside className="card game-sidebar">
        <Scoreboard
          scoreboard={game.scoreboard}
          isHost={isHost}
          onReturnToLobby={onReturnToLobby}
        />
      </aside>
    </main>
  );
}

function roundStateTeamLabel(activeTeam) {
  if (activeTeam === "A") {
    return "Team A";
  }

  if (activeTeam === "B") {
    return "Team B";
  }

  return "Spectator";
}

function buildRevealSequence(teamAGuesses, teamBGuesses) {
  const maxLength = Math.max(teamAGuesses.length, teamBGuesses.length);
  const sequence = [];

  for (let index = 0; index < maxLength; index += 1) {
    if (teamAGuesses[index]) {
      sequence.push(teamAGuesses[index].playerName);
    }

    if (teamBGuesses[index]) {
      sequence.push(teamBGuesses[index].playerName);
    }
  }

  return sequence;
}
