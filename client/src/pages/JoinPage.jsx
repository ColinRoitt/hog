import { useState } from "react";

export function JoinPage({ initialName, initialRoom, onJoin, error }) {
  const [playerName, setPlayerName] = useState(initialName);
  const [roomName, setRoomName] = useState(initialRoom);

  function handleSubmit(event) {
    event.preventDefault();
    onJoin({ playerName, roomName });
  }

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">House of Games</p>
        <h1>Join a room</h1>
        <p className="subtle">
          Pick a name, type a room, and everyone lands in the same lobby.
        </p>

        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Your name</span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Colin"
              maxLength={24}
            />
          </label>

          <label className="field">
            <span>Room name</span>
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="thursday-night"
              maxLength={24}
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit">Join room</button>
        </form>
      </section>
    </main>
  );
}
