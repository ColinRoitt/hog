export function LobbyPage({ roomState, onStartGame }) {
  const players = roomState.room.players;
  const host = players.find((player) => player.isHost);
  const isHost = roomState.room.hostId === roomState.selfPlayerId;
  const availableGames = roomState.room.availableGames || [];

  return (
    <main className="shell">
      <section className="card">
        <div className="space-between">
          <div>
            <p className="eyebrow">Lobby</p>
            <h1>{roomState.room.name}</h1>
          </div>
          <div className="badge">{players.length} players</div>
        </div>

        <p className="subtle">
          {host ? `${host.name} can start the first game.` : "Waiting for a host."}
        </p>

        <div className="panel">
          <h2>Players</h2>
          <ul className="player-list">
            {players.map((player) => (
              <li key={player.id}>
                <span>
                  {player.name} - {player.totalPoints} pts
                </span>
                <span className={player.connected ? "status online" : "status offline"}>
                  {player.isHost ? "host" : player.connected ? "online" : "offline"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>Minigames</h2>
          {availableGames.length ? (
            <div className="game-grid">
              {availableGames.map((game) => (
                <article key={game.type} className="game-card">
                  <p className="game-title">{game.name}</p>
                  <p className="subtle">{game.description}</p>
                  <button
                    type="button"
                    onClick={() => onStartGame(game.type)}
                    disabled={!isHost}
                  >
                    {isHost ? "Start this game" : "Waiting for host"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="subtle">No minigames are available yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
