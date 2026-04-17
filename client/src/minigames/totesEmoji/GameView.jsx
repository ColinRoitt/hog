import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_PHASES } from "shared";
import { PendingSubmittersNote } from "../../components/PendingSubmittersNote.jsx";
import "emoji-picker-element";

function TotesEmojiPicker({ disabled, onEmojiPicked }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) {
      return undefined;
    }

    picker.classList.add("dark");

    function handleEmojiClick(event) {
      if (disabled) {
        return;
      }

      const unicode = event.detail?.unicode;
      if (unicode) {
        onEmojiPicked(unicode);
      }
    }

    picker.addEventListener("emoji-click", handleEmojiClick);
    return () => {
      picker.removeEventListener("emoji-click", handleEmojiClick);
    };
  }, [disabled, onEmojiPicked]);

  return (
    <div className={`totes-emoji-picker-wrap${disabled ? " totes-emoji-picker-wrap--disabled" : ""}`}>
      <emoji-picker ref={pickerRef} />
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

export function TotesEmojiGameView({
  roomState,
  onSubmitTotesEmojiClue,
  onSubmitTotesEmojiTitleGuess,
  onRerollTotesEmojiTitle,
  onNextRound,
  onReturnToLobby,
}) {
  const [emojiClue, setEmojiClue] = useState("");
  const [titleGuess, setTitleGuess] = useState("");
  const game = roomState.game;
  const round = game.currentRound;
  const isHost = roomState.room.hostId === roomState.selfPlayerId;

  const appendEmojiToClue = useCallback((unicode) => {
    setEmojiClue((prev) => (prev + unicode).slice(0, 200));
  }, []);

  const prevEntryTitleRef = useRef(null);

  useEffect(() => {
    setEmojiClue("");
    setTitleGuess("");
    prevEntryTitleRef.current = null;
  }, [game.roundNumber]);

  useEffect(() => {
    if (game.phase !== GAME_PHASES.TOTES_EMOJI_ENTRY || !round?.myTitle || round.hasSubmittedEmoji) {
      return;
    }

    const prev = prevEntryTitleRef.current;
    if (prev && prev !== round.myTitle) {
      setEmojiClue("");
    }

    prevEntryTitleRef.current = round.myTitle;
  }, [game.phase, round?.myTitle, round?.hasSubmittedEmoji]);

  if (!round && game.phase === GAME_PHASES.FINISHED) {
    return (
      <main className="shell game-layout">
        <section className="card game-main">
          <p className="eyebrow">Game complete</p>
          <h1>Totes Emoji</h1>
          <div className="panel">
            <h2>That&apos;s a wrap</h2>
            <p className="subtle">
              Not enough players stayed connected, or the title bank ran out. Head back to the lobby
              to play again.
            </p>
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
          <h1>Totes Emoji</h1>
          <p className="subtle">Waiting for round state…</p>
        </section>
      </main>
    );
  }

  function handleEmojiSubmit(event) {
    event.preventDefault();
    onSubmitTotesEmojiClue(emojiClue);
  }

  function handleTitleSubmit(event) {
    event.preventDefault();
    onSubmitTotesEmojiTitleGuess(titleGuess);
  }

  return (
    <main className="shell game-layout">
      <section className="card game-main">
        <p className="eyebrow">Round {game.roundNumber}</p>
        <h1>Totes Emoji</h1>

        {game.phase === GAME_PHASES.TOTES_EMOJI_ENTRY ? (
          <>
            <div className="panel">
              <h2>This round&apos;s theme</h2>
              <p className="question">{round.themeLabel}</p>
              <p className="subtle">
                Your item is shown only to you. Describe it using emoji only — no words or numbers.
              </p>
              {round.myTitle ? (
                <div className="totes-my-title-block">
                  <p className="totes-my-title">
                    <span className="subtle">Your {round.themeLabel.toLowerCase()}:</span>{" "}
                    <strong>{round.myTitle}</strong>
                  </p>
                  <div className="totes-title-actions">
                    <button
                      type="button"
                      className="totes-reroll-button"
                      onClick={() => onRerollTotesEmojiTitle()}
                      disabled={!round.canRerollTitle}
                    >
                      {round.hasUsedTitleReroll
                        ? "Re-roll used"
                        : round.hasSubmittedEmoji
                          ? "Re-roll locked"
                          : "Re-roll title (once)"}
                    </button>
                    {round.hasUsedTitleReroll ? (
                      <p className="subtle">You already re-rolled this round.</p>
                    ) : round.hasSubmittedEmoji ? (
                      <p className="subtle">Re-roll is only available before you submit emoji.</p>
                    ) : (
                      <p className="subtle">Swap your title for another from this category once.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="subtle">You are not in this round (reconnect and wait for the next one).</p>
              )}
            </div>

            <form className="panel stack" onSubmit={handleEmojiSubmit}>
              <h2>Your emoji clue</h2>
              <label htmlFor="totes-emoji-clue">Your clue</label>
              <input
                id="totes-emoji-clue"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="Tap emoji below or paste here"
                value={emojiClue}
                onChange={(event) => setEmojiClue(event.target.value)}
                disabled={!round.myTitle || round.hasSubmittedEmoji}
              />
              <div className="stack totes-emoji-picker-block">
                <p className="subtle">Emoji picker</p>
                <TotesEmojiPicker
                  disabled={!round.myTitle || round.hasSubmittedEmoji}
                  onEmojiPicked={appendEmojiToClue}
                />
              </div>
              <p className="subtle">
                Submitted {round.submittedEmojiCount} / {round.expectedEmojiCount}
                <PendingSubmittersNote names={round.pendingSubmitNames} />
              </p>
              <button type="submit" disabled={!round.myTitle || round.hasSubmittedEmoji || !emojiClue.trim()}>
                {round.hasSubmittedEmoji ? "Locked in" : "Submit emoji"}
              </button>
            </form>
          </>
        ) : null}

        {game.phase === GAME_PHASES.TOTES_EMOJI_GUESSING ? (
          <>
            <div className="panel">
              <h2>Guess the title</h2>
              <p className="subtle">Theme this round: {round.themeLabel}</p>
              <p className="subtle">
                <strong>{round.currentGuesserName}</strong> is guessing{" "}
                <strong>{round.currentTargetName || "…"}</strong>&apos;s clue.
              </p>
              <div className="totes-emoji-display" aria-label="Emoji clue to guess">
                {round.currentEmoji || "…"}
              </div>
            </div>

            {round.lastGuess ? (
              <div className={`panel totes-last-guess ${round.lastGuess.correct ? "correct" : "wrong"}`}>
                <h3>Last guess</h3>
                <p>
                  <strong>{round.lastGuess.guesserName}</strong> said{" "}
                  <strong>{round.lastGuess.guess}</strong> for <strong>{round.lastGuess.targetName}</strong>
                  &apos;s clue — {round.lastGuess.correct ? "correct" : "wrong"}.
                  {!round.lastGuess.correct ? (
                    <>
                      {" "}
                      Answer: <strong>{round.lastGuess.answerTitle}</strong>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}

            {round.isMyTurnToGuess ? (
              <form className="panel stack" onSubmit={handleTitleSubmit}>
                <h2>Your guess</h2>
                <p className="subtle">Pick from suggestions or type the full title.</p>
                <input
                  id="totes-title-guess"
                  type="text"
                  list="totes-emoji-title-options"
                  autoComplete="off"
                  value={titleGuess}
                  onChange={(event) => setTitleGuess(event.target.value)}
                  placeholder="Start typing a title…"
                />
                <datalist id="totes-emoji-title-options">
                  {(round.titleOptions || []).map((title) => (
                    <option key={title} value={title} />
                  ))}
                </datalist>
                <button type="submit" disabled={!titleGuess.trim()}>
                  Submit guess
                </button>
              </form>
            ) : (
              <div className="panel">
                <h2>Watching</h2>
                {/* <p className="subtle">When it is your turn, you will get the text box and autocomplete.</p> */}
              </div>
            )}

          </>
        ) : null}

        {game.phase === GAME_PHASES.REVEAL ? (
          <>
            <div className="panel">
              <h2>Round reveal</h2>
              <p className="subtle">Who had what, and what did everyone guess?</p>
              <ul className="score-list">
                {round.revealRows?.map((row) => (
                  <li key={row.playerId}>
                    <span>
                      <strong>{row.playerName}</strong>: {row.title}
                    </span>
                    <span className="totes-emoji-inline">{row.emoji}</span>
                  </li>
                ))}
              </ul>
            </div>

            {round.guessHistory?.length ? (
              <div className="panel">
                <h3>Guesses</h3>
                <ul className="score-list">
                  {round.guessHistory.map((entry, index) => (
                    <li key={`reveal-${entry.guesserName}-${index}`}>
                      <span>
                        {entry.guesserName} guessed &quot;{entry.guess}&quot; for {entry.targetName} —{" "}
                        {entry.correct ? "right" : "wrong"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="panel">
              <button type="button" onClick={onNextRound} disabled={!isHost}>
                {isHost ? "Next round" : "Waiting for host"}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <aside className="card game-sidebar">
        <Scoreboard scoreboard={game.scoreboard} isHost={isHost} onReturnToLobby={onReturnToLobby} />
      </aside>
    </main>
  );
}
