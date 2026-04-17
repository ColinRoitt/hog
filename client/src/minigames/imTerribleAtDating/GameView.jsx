import { useEffect, useState } from "react";
import { GAME_PHASES } from "shared";
import { formatHistoricalYear, signedYearFromParts } from "../../lib/historicalYear.js";

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

export function ImTerribleAtDatingGameView({
  roomState,
  onSubmitImTerribleAtDatingGuess,
  onNextRound,
  onReturnToLobby,
}) {
  const [yearDigits, setYearDigits] = useState("");
  const [isBC, setIsBC] = useState(false);
  const game = roomState.game;
  const round = game.currentRound;
  const isHost = roomState.room.hostId === roomState.selfPlayerId;

  useEffect(() => {
    setYearDigits("");
    setIsBC(false);
  }, [game.roundNumber]);

  if (!round && game.phase === GAME_PHASES.FINISHED) {
    return (
      <main className="shell game-layout">
        <section className="card game-main">
          <p className="eyebrow">Game complete</p>
          <h1>I'm Terrible at Dating</h1>
          <div className="panel">
            <h2>No more questions</h2>
            <p className="subtle">Game over. Return to lobby to pick another minigame.</p>
            <button type="button" onClick={onReturnToLobby} disabled={!isHost}>
              {isHost ? "Back to lobby" : "Waiting for host"}
            </button>
          </div>
        </section>
        <aside className="card game-sidebar">
          <Scoreboard scoreboard={game.scoreboard} isHost={isHost} onReturnToLobby={onReturnToLobby} />
        </aside>
      </main>
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    const signed = signedYearFromParts(yearDigits, isBC);
    if (signed === null) {
      return;
    }

    onSubmitImTerribleAtDatingGuess(signed);
  }

  const previewSigned = signedYearFromParts(yearDigits, isBC);

  return (
    <main className="shell game-layout">
      <section className="card game-main">
        <p className="eyebrow">Round {game.roundNumber}</p>
        <h1>I'm Terrible at Dating</h1>

        <div className="panel">
          <h2>When did it happen?</h2>
          <p className="question">{round.question}</p>
          <p className="subtle">
            Enter the calendar year - toggle between AD and BC.
          </p>
        </div>

        {game.phase === GAME_PHASES.COLLECTING_FAKE_ANSWERS ? (
          <form className="panel stack" onSubmit={handleSubmit}>
            <h2>Your guess</h2>
            <p className="subtle">Enter the year, then tap AD or BC.</p>
            <div className="dating-year-inline">
              <input
                id="dating-year"
                className="dating-year-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9,]*"
                autoComplete="off"
                aria-label="Year (digits only)"
                value={yearDigits}
                onChange={(event) => setYearDigits(event.target.value.replace(/[^\d,]/g, ""))}
                placeholder="e.g. 1865"
                disabled={round.hasSubmittedGuess}
              />
              <div className="dating-era-toggle" role="group" aria-label="Era">
                <button
                  type="button"
                  className={!isBC ? "active" : ""}
                  aria-pressed={!isBC}
                  disabled={round.hasSubmittedGuess}
                  onClick={() => setIsBC(false)}
                >
                  AD
                </button>
                <button
                  type="button"
                  className={isBC ? "active" : ""}
                  aria-pressed={isBC}
                  disabled={round.hasSubmittedGuess}
                  onClick={() => setIsBC(true)}
                >
                  BC
                </button>
              </div>
            </div>
            {previewSigned !== null ? (
              <p className="subtle">
                You will submit: <strong>{formatHistoricalYear(previewSigned)}</strong>
              </p>
            ) : (
              <p className="subtle">Enter a year</p>
            )}
            <button type="submit" disabled={round.hasSubmittedGuess || previewSigned === null}>
              {round.hasSubmittedGuess ? "Submitted" : "Lock in guess"}
            </button>
            <p className="subtle">
              {round.submittedCount} of {round.expectedCount} guesses in.
            </p>
          </form>
        ) : null}

        {game.phase === GAME_PHASES.REVEAL ? (
          <div className="panel stack">
            <h2>Results</h2>
            <p className="subtle">
              Correct: <strong>{formatHistoricalYear(round.correctAnswer)}</strong> (raw{" "}
              <strong>{round.correctAnswer}</strong>)
            </p>
            <p className="subtle">
              Point{round.winners.length > 1 ? "s" : ""} to:{" "}
              {round.winners
                .map((id) => roomState.room.players.find((player) => player.id === id)?.name || "Unknown")
                .join(", ")}
            </p>
            <ul className="score-list">
              {(round.revealRows || []).map((row) => {
                const isWinner = round.winners.includes(row.playerId);
                return (
                  <li key={row.playerId}>
                    <span>
                      {row.playerName}
                      {isWinner ? " (point)" : ""}
                    </span>
                    <strong>
                      {formatHistoricalYear(row.guess)} — off by {row.distance.toLocaleString("en-GB")}
                    </strong>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={onNextRound} disabled={!isHost}>
              {isHost ? "Next round" : "Waiting for host"}
            </button>
          </div>
        ) : null}
      </section>

      <aside className="card game-sidebar">
        <Scoreboard scoreboard={game.scoreboard} isHost={isHost} onReturnToLobby={onReturnToLobby} />
      </aside>
    </main>
  );
}
