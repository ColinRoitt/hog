import { useEffect, useState } from "react";
import { GAME_PHASES } from "shared";
import { PendingSubmittersNote } from "../../components/PendingSubmittersNote.jsx";

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

export function NiceRoundGameView({
  roomState,
  onSubmitNiceRoundClue,
  onSubmitNiceRoundTitleGuess,
  onSubmitNiceRoundBestClue,
  onNextRound,
  onReturnToLobby,
}) {
  const [clueWord, setClueWord] = useState("");
  const [titleGuess, setTitleGuess] = useState("");
  const game = roomState.game;
  const round = game.currentRound;
  const isHost = roomState.room.hostId === roomState.selfPlayerId;

  useEffect(() => {
    setClueWord("");
    setTitleGuess("");
  }, [game.roundNumber]);

  if (!round && game.phase === GAME_PHASES.FINISHED) {
    return (
      <main className="shell game-layout">
        <section className="card game-main">
          <p className="eyebrow">Game complete</p>
          <h1>The Nice Round</h1>
          <div className="panel">
            <h2>That&apos;s all</h2>
            <p className="subtle">Not enough players stayed connected. Head back to the lobby.</p>
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

  if (!round) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Loading</p>
          <h1>The Nice Round</h1>
          <p className="subtle">Waiting for round state…</p>
        </section>
      </main>
    );
  }

  function handleClueSubmit(event) {
    event.preventDefault();
    onSubmitNiceRoundClue(clueWord);
    setClueWord("");
  }

  function handleTitleSubmit(event) {
    event.preventDefault();
    onSubmitNiceRoundTitleGuess(titleGuess);
  }

  const gatheringClues =
    game.phase === GAME_PHASES.NICE_ROUND_CLUES && !round.clueGatheringComplete;

  return (
    <main className="shell game-layout">
      <section className="card game-main">
        <p className="eyebrow">Round {game.roundNumber}</p>
        <h1>The Nice Round</h1>

        <div className="panel">
          <h2>This round</h2>
          <p className="question nice-round-category">
            Category: <strong>{round.themeLabel}</strong>
          </p>
          <p className="subtle">
            The answer is always a <strong>{round.themeLabel.toLowerCase()}</strong> title from the bank.
          </p>
          <p className="subtle">
            Guesser: <strong>{round.guesserName}</strong>
            {round.isGuesser ? " (that’s you)" : null}
          </p>
          {round.knowAnswer && round.answerTitle ? (
            <p className="totes-my-title">
              <span className="subtle">Secret title:</span> <strong>{round.answerTitle}</strong>
            </p>
          ) : (
            <p className="subtle">Only clue-givers see the secret title until the reveal.</p>
          )}
        </div>

        {gatheringClues ? (
          <div className="panel stack">
            <h3>Clues locked in</h3>
            <p className="subtle">
              {round.clueSubmittedCount} / {round.clueExpectedCount} clue-givers have submitted. Words stay
              hidden until everyone has locked in.
              <PendingSubmittersNote names={round.pendingSubmitNames} />
            </p>
            {round.myLockedClue ? (
              <p className="subtle">
                Your clue: <strong>{round.myLockedClue}</strong>
              </p>
            ) : null}
          </div>
        ) : null}

        {!gatheringClues && round.clues?.length ? (
          <div className="panel">
            <h3>Clues</h3>
            <ul className="score-list">
              {round.clues.map((entry, index) => (
                <li key={`${entry.playerName}-${index}`}>
                  <span>{entry.playerName}</span>
                  <strong>{entry.word}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {game.phase === GAME_PHASES.NICE_ROUND_CLUES ? (
          <div className="panel stack">
            <h2>One-word clues</h2>
            <p className="subtle">
              All clue-givers enter a clue at the same time. One word only (letters, numbers, hyphen, or
              apostrophe; no spaces).
            </p>
            {round.canSubmitClue ? (
              <form onSubmit={handleClueSubmit}>
                <label htmlFor="nice-clue-word">Your clue</label>
                <input
                  id="nice-clue-word"
                  type="text"
                  autoComplete="off"
                  value={clueWord}
                  onChange={(event) => setClueWord(event.target.value.replace(/\s/g, ""))}
                  placeholder="e.g. robots"
                />
                <button type="submit" disabled={!clueWord.trim()}>
                  Lock in clue
                </button>
              </form>
            ) : null}
            {round.isGuesser && gatheringClues ? (
              <p className="subtle">Wait until every clue-giver has locked in — then all clues appear together.</p>
            ) : null}
            {!round.isGuesser && !round.canSubmitClue && gatheringClues && round.myLockedClue ? (
              <p className="subtle">You&apos;re done — hang tight for the others.</p>
            ) : null}
          </div>
        ) : null}

        {game.phase === GAME_PHASES.NICE_ROUND_GUESSING ? (
          <div className="panel stack">
            <h2>Guess the title</h2>
            {round.isGuesser ? (
              <form onSubmit={handleTitleSubmit}>
                <p className="subtle">Use the list or type the full title.</p>
                <input
                  id="nice-title-guess"
                  type="text"
                  list="nice-round-title-options"
                  autoComplete="off"
                  value={titleGuess}
                  onChange={(event) => setTitleGuess(event.target.value)}
                  placeholder="Title…"
                />
                <datalist id="nice-round-title-options">
                  {(round.titleOptions || []).map((title) => (
                    <option key={title} value={title} />
                  ))}
                </datalist>
                <button type="submit" disabled={!titleGuess.trim()}>
                  Submit guess
                </button>
              </form>
            ) : (
              <p className="subtle">The guesser is typing their answer.</p>
            )}
          </div>
        ) : null}

        {game.phase === GAME_PHASES.NICE_ROUND_PICK_BEST ? (
          <div className="panel stack">
            <h2>Best clue</h2>
            <p className="subtle">You got it right — tap who gave you the most helpful clue. They earn a point.</p>
            {round.isGuesser ? (
              <ul className="nice-best-clue-list">
                {(round.bestClueOptions || []).map((option) => (
                  <li key={option.playerId}>
                    <button type="button" onClick={() => onSubmitNiceRoundBestClue(option.playerId)}>
                      {option.playerName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle">The guesser is choosing who gets the bonus point.</p>
            )}
          </div>
        ) : null}

        {game.phase === GAME_PHASES.REVEAL ? (
          <div className="panel stack">
            <h2>Reveal</h2>
            <p className="question">Category: {round.themeLabel}</p>
            <p className="question">Answer: {round.answerTitle}</p>
            <p className="subtle">
              {round.guessCorrect
                ? round.pickedBestCluePlayerName
                  ? `Correct guess — bonus point to ${round.pickedBestCluePlayerName}.`
                  : "Correct guess."
                : "Nobody scored the guess this time."}
            </p>
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
