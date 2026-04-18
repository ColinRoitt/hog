import { useEffect, useState } from "react";
import { GAME_PHASES } from "shared";
import { PendingSubmittersNote } from "../../components/PendingSubmittersNote.jsx";

export function JokerGameView({
  roomState,
  onSubmitJokerSetup,
  onSubmitJokerPunchline,
  onNextRound,
  onReturnToLobby,
}) {
  const [setupDraft, setSetupDraft] = useState("");
  const [punchlineDraft, setPunchlineDraft] = useState("");
  const game = roomState.game;
  const round = game.currentRound;
  const isHost = roomState.room.hostId === roomState.selfPlayerId;

  useEffect(() => {
    setSetupDraft("");
    setPunchlineDraft("");
  }, [game.roundNumber]);

  if (!round && game.phase === GAME_PHASES.FINISHED) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Game complete</p>
          <h1>Joker</h1>
          <p className="subtle">Not enough players stayed connected.</p>
          <button type="button" onClick={onReturnToLobby} disabled={!isHost}>
            {isHost ? "Back to lobby" : "Waiting for host"}
          </button>
        </section>
      </main>
    );
  }

  if (!round) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Loading</p>
          <h1>Joker</h1>
        </section>
      </main>
    );
  }

  function handleSetupSubmit(event) {
    event.preventDefault();
    onSubmitJokerSetup(setupDraft);
    setSetupDraft("");
  }

  function handlePunchlineSubmit(event) {
    event.preventDefault();
    onSubmitJokerPunchline(punchlineDraft);
    setPunchlineDraft("");
  }

  return (
    <main className="shell">
      <section className="card game-main" style={{ maxWidth: "720px", width: "100%" }}>
        <p className="eyebrow">Round {game.roundNumber}</p>
        <h1>Joker</h1>

        {game.phase === GAME_PHASES.JOKER_SETUPS ? (
          <div className="panel stack">
            <h2>Write a joke setup</h2>
            <p className="subtle">
              Lead the audience in — no punchline yet. Everyone submits at the same time.
            </p>
            <p className="subtle">
              {round.submittedSetupCount} of {round.expectedSetupCount} setups in.
              <PendingSubmittersNote names={round.pendingSubmitNames} />
            </p>
            <form onSubmit={handleSetupSubmit}>
              <label htmlFor="joker-setup">Your setup</label>
              <textarea
                id="joker-setup"
                rows={4}
                value={setupDraft}
                onChange={(event) => setSetupDraft(event.target.value)}
                disabled={round.hasSubmittedSetup}
                placeholder="e.g. Why did the scarecrow get promoted?"
              />
              <button type="submit" disabled={round.hasSubmittedSetup || setupDraft.trim().length < 8}>
                {round.hasSubmittedSetup ? "Submitted" : "Lock in setup"}
              </button>
            </form>
          </div>
        ) : null}

        {game.phase === GAME_PHASES.JOKER_PUNCHLINES ? (
          <div className="panel stack">
            <h2>Write the punchline</h2>
            <p className="subtle">
              You were assigned <strong>{round.assignedSetupAuthorName}</strong>&apos;s setup — not your own.
            </p>
            <div className="joker-assigned-setup">
              <p className="eyebrow">Setup</p>
              <p className="question">{round.assignedSetupText}</p>
            </div>
            <p className="subtle">
              {round.submittedPunchlineCount} of {round.expectedPunchlineCount} punchlines in.
              <PendingSubmittersNote names={round.pendingSubmitNames} />
            </p>
            <form onSubmit={handlePunchlineSubmit}>
              <label htmlFor="joker-punchline">Your punchline</label>
              <textarea
                id="joker-punchline"
                rows={3}
                value={punchlineDraft}
                onChange={(event) => setPunchlineDraft(event.target.value)}
                disabled={round.hasSubmittedPunchline}
                placeholder="Land the joke…"
              />
              <button type="submit" disabled={round.hasSubmittedPunchline || !punchlineDraft.trim()}>
                {round.hasSubmittedPunchline ? "Submitted" : "Lock in punchline"}
              </button>
            </form>
          </div>
        ) : null}

        {game.phase === GAME_PHASES.JOKER_REVEAL ? (
          <div className="panel stack">
            <h2>Reveal</h2>
            <p className="subtle">Each card: setup first, then the punchline someone wrote for it.</p>
            <ul className="joker-reveal-list">
              {(round.revealPairs || []).map((pair, index) => (
                <li key={index} className="joker-reveal-card">
                  <p className="eyebrow">Setup — {pair.setupAuthorName}</p>
                  <p className="question">{pair.setupText}</p>
                  <p className="eyebrow">Punchline — {pair.punchlineAuthorName}</p>
                  <p className="subtle joker-punchline-line">{pair.punchlineText}</p>
                </li>
              ))}
            </ul>
            <button type="button" onClick={onNextRound} disabled={!isHost}>
              {isHost ? "Next round" : "Waiting for host"}
            </button>
          </div>
        ) : null}

        <div className="panel">
          <button type="button" className="joker-lobby-button" onClick={onReturnToLobby} disabled={!isHost}>
            {isHost ? "Return to lobby" : "Waiting for host"}
          </button>
        </div>
      </section>
    </main>
  );
}
