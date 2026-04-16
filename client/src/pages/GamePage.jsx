import { gameViewsByType } from "../minigames";

export function GamePage(props) {
  const GameView = gameViewsByType[props.roomState.game?.type];

  if (!GameView) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Unsupported game</p>
          <h1>Minigame not wired yet</h1>
          <p className="subtle">
            This room started a minigame that does not have a client view yet.
          </p>
        </section>
      </main>
    );
  }

  return <GameView {...props} />;
}
