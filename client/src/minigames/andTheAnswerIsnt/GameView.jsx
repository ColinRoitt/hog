import { useEffect, useMemo, useState } from "react";
import { GAME_PHASES } from "shared";
import { PendingSubmittersNote } from "../../components/PendingSubmittersNote.jsx";

function Scoreboard({ scoreboard, isHost, onReturnToLobby }) {
  return (
    <div className="panel">
      <h2>Scores</h2>
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

function WaitingCopy({ round }) {
  return (
    <div className="panel">
      <h2>Question</h2>
      <p className="question">{round.question}</p>
      <p className="subtle">
        {round.guesserName} is guessing this round. Everyone else should submit a believable fake
        answer.
      </p>
    </div>
  );
}

function AnswerList({ answerOptions, isSelectable, onSelect, selectedOptionId, showOwners }) {
  return (
    <div className="options">
      {answerOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`option ${selectedOptionId === option.id ? "option-selected" : ""} ${
            option.isCorrect ? "option-correct" : ""
          }`}
          disabled={!isSelectable}
          onClick={() => onSelect(option.id)}
        >
          <span>{option.text}</span>
          {showOwners ? (
            <span className="option-meta">
              {option.ownerName}
              {option.isCorrect ? " (real answer)" : ""}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function AndTheAnswerIsntGameView({
  roomState,
  onSubmitFakeAnswer,
  onSubmitGuess,
  onNextRound,
  onReturnToLobby,
}) {
  const [fakeAnswer, setFakeAnswer] = useState("");
  const game = roomState.game;
  const round = game.currentRound;
  const isHost = roomState.room.hostId === roomState.selfPlayerId;

  useEffect(() => {
    setFakeAnswer("");
  }, [game.roundNumber]);

  const selectedOption = useMemo(
    () => round?.answerOptions?.find((option) => option.id === round.selectedOptionId),
    [round],
  );

  if (!round && game.phase === GAME_PHASES.FINISHED) {
    return (
      <main className="shell game-layout">
        <section className="card game-main">
          <p className="eyebrow">Game complete</p>
          <h1>And the Answer Isn&apos;t</h1>
          <div className="panel">
            <h2>Game over</h2>
            <p className="subtle">Everyone has taken a turn.</p>
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

  function handleFakeAnswerSubmit(event) {
    event.preventDefault();
    onSubmitFakeAnswer(fakeAnswer);
  }

  return (
    <main className="shell game-layout">
      <section className="card game-main">
        <p className="eyebrow">Round {game.roundNumber}</p>
        <h1>And the Answer Isn&apos;t</h1>
        <WaitingCopy round={round} />

        {game.phase === GAME_PHASES.COLLECTING_FAKE_ANSWERS && !round.isGuesser ? (
          <form className="panel stack" onSubmit={handleFakeAnswerSubmit}>
            <h2>Your bluff</h2>
            <input
              value={fakeAnswer}
              onChange={(event) => setFakeAnswer(event.target.value)}
              placeholder="Type a believable wrong answer"
              maxLength={60}
              disabled={round.hasSubmittedFakeAnswer}
            />
            <button type="submit" disabled={round.hasSubmittedFakeAnswer}>
              {round.hasSubmittedFakeAnswer ? "Submitted" : "Submit fake answer"}
            </button>
            <p className="subtle">
              {round.fakeAnswersSubmittedCount} of {round.fakeAnswersExpectedCount} answers in.
              <PendingSubmittersNote names={round.pendingSubmitNames} />
            </p>
          </form>
        ) : null}

        {game.phase === GAME_PHASES.COLLECTING_FAKE_ANSWERS && round.isGuesser ? (
          <div className="panel">
            <h2>Hold tight</h2>
            <p className="subtle">Waiting for everyone else to submit their fake answers.</p>
            <p className="subtle">
              {round.fakeAnswersSubmittedCount} of {round.fakeAnswersExpectedCount} answers in.
              <PendingSubmittersNote names={round.pendingSubmitNames} />
            </p>
          </div>
        ) : null}

        {game.phase === GAME_PHASES.GUESSING ? (
          <div className="panel stack">
            <h2>{round.isGuesser ? "Pick the real answer" : "Guess in progress"}</h2>
            <AnswerList
              answerOptions={round.answerOptions}
              isSelectable={round.isGuesser}
              onSelect={onSubmitGuess}
              selectedOptionId={round.selectedOptionId}
              showOwners={false}
            />
          </div>
        ) : null}

        {game.phase === GAME_PHASES.REVEAL ? (
          <div className="panel stack">
            <h2>Reveal</h2>
            <p className="subtle">
              {round.guesserName} picked{" "}
              <strong>{selectedOption ? selectedOption.text : "an answer"}</strong>.
            </p>
            <p className="subtle">Correct answer: {round.correctAnswer}</p>
            <p className={round.guessedCorrectly ? "success" : "error"}>
              {round.guessedCorrectly ? "Correct guess." : "That bluff worked."}
            </p>
            <AnswerList
              answerOptions={round.answerOptions}
              isSelectable={false}
              onSelect={() => {}}
              selectedOptionId={round.selectedOptionId}
              showOwners
            />
            <button type="button" onClick={onNextRound} disabled={!round.isGuesser}>
              {round.isGuesser ? "Next round" : "Waiting for guesser"}
            </button>
          </div>
        ) : null}

        {game.phase === GAME_PHASES.FINISHED ? (
          <div className="panel stack">
            <h2>Game over</h2>
            <p className="subtle">Everyone has taken a turn.</p>
            <button type="button" onClick={onReturnToLobby} disabled={!isHost}>
              {isHost ? "Back to lobby" : "Waiting for host"}
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
