import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { GAME_PHASES } from "shared";

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

function MapClickHandler({ enabled, onPick }) {
  useMapEvents({
    click(event) {
      if (!enabled) {
        return;
      }

      onPick(event.latlng);
    },
  });

  return null;
}

export function WhereIsKazakhstanGameView({
  roomState,
  onSubmitMapGuess,
  onNextMapRevealStep,
  onNextMapRound,
  onReturnToLobby,
}) {
  const [draftGuess, setDraftGuess] = useState(null);
  const game = roomState.game;
  const round = game.currentRound;
  const isHost = roomState.room.hostId === roomState.selfPlayerId;
  const mapView = round?.mapView;

  useEffect(() => {
    setDraftGuess(null);
  }, [game.roundNumber, round?.promptIndex, game.phase]);

  const revealedSteps = useMemo(() => {
    if (!round?.revealSteps?.length) {
      return [];
    }

    return round.revealSteps.slice(0, round.revealIndex + 1);
  }, [round]);

  if (!round && game.phase === GAME_PHASES.FINISHED) {
    return (
      <main className="shell game-layout">
        <section className="card game-main">
          <p className="eyebrow">Game complete</p>
          <h1>Where is Kazakhstan?</h1>
          <div className="panel">
            <h2>No more locations</h2>
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

  function handleSubmitGuess() {
    if (!draftGuess) {
      return;
    }

    onSubmitMapGuess({ lat: draftGuess.lat, lon: draftGuess.lng });
    setDraftGuess(null);
  }

  return (
    <main className="shell game-layout">
      <section className="card game-main">
        <p className="eyebrow">
          Continent trip {round.continentTripNumber ?? game.roundNumber} · Clue {(round.promptIndex ?? 0) + 1} of{" "}
          {round.promptTotal ?? 1}
        </p>
        <h1>Where is Kazakhstan?</h1>

        <div className="panel">
          <h2>Clue</h2>
          <p className="eyebrow">{round.continentLabel}</p>
          <p className="question">{round.clue}</p>
          <p className="subtle">Drop your pin without conferring with anyone else.</p>
        </div>

        <div className="map-shell">
          <MapContainer
            key={`${round.continentKey}-${round.continentTripNumber ?? game.roundNumber}-${round.promptIndex ?? 0}`}
            className="map-frame"
            center={mapView.center}
            zoom={mapView.zoom}
            minZoom={Math.max(2, mapView.zoom - 1)}
            maxZoom={Math.min(8, mapView.zoom + 2)}
            maxBounds={mapView.maxBounds}
            maxBoundsViscosity={1}
            worldCopyJump
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler
              enabled={game.phase === GAME_PHASES.MAP_PLACING && !round.hasSubmittedGuess}
              onPick={(latlng) => setDraftGuess(latlng)}
            />

            {draftGuess ? (
              <CircleMarker
                center={[draftGuess.lat, draftGuess.lng]}
                radius={6}
                pathOptions={{ color: "#ffd84d", fillColor: "#11b2c3", fillOpacity: 0.9 }}
              />
            ) : null}

            {revealedSteps.map((step, index) => {
              if (step.type === "player") {
                const isWinner =
                  game.phase === GAME_PHASES.MAP_SCORING && (round.winners || []).includes(step.playerId);

                return (
                  <CircleMarker
                    key={`${step.playerId}-${index}`}
                    center={[step.lat, step.lon]}
                    radius={isWinner ? 9 : 6}
                    pathOptions={{
                      color: "#ffd84d",
                      fillColor: isWinner ? "#11b2c3" : "#fbeaeb",
                      fillOpacity: 0.95,
                    }}
                  />
                );
              }

              return (
                <CircleMarker
                  key={`correct-${index}`}
                  center={[step.lat, step.lon]}
                  radius={game.phase === GAME_PHASES.MAP_SCORING ? 10 : 8}
                  pathOptions={{ color: "#ffd84d", fillColor: "#e10711", fillOpacity: 0.95 }}
                />
              );
            })}
          </MapContainer>
        </div>

        {game.phase === GAME_PHASES.MAP_PLACING ? (
          <div className="panel stack">
            <h2>Your guess</h2>
            <p className="subtle">
              {draftGuess
                ? `Selected: ${draftGuess.lat.toFixed(3)}, ${draftGuess.lng.toFixed(3)}`
                : "Tap the map to place your pin."}
            </p>
            <button type="button" onClick={handleSubmitGuess} disabled={!draftGuess || round.hasSubmittedGuess}>
              {round.hasSubmittedGuess ? "Submitted" : "Lock in guess"}
            </button>
            <p className="subtle">
              {round.submittedCount} of {round.expectedCount} guesses in.
            </p>
          </div>
        ) : null}

        {game.phase === GAME_PHASES.MAP_REVEAL ? (
          <div className="panel stack">
            <h2>Reveal</h2>
            <p className="subtle">
              Step {round.revealIndex + 1} of {round.revealSteps.length}
            </p>
            <RevealCopy round={round} />
            <button type="button" onClick={onNextMapRevealStep} disabled={!isHost}>
              {isHost ? "Reveal next" : "Waiting for host"}
            </button>
          </div>
        ) : null}

        {game.phase === GAME_PHASES.MAP_SCORING ? (
          <div className="panel stack">
            <h2>Results</h2>
            <p className="subtle">
              Winners:{" "}
              {(round.winners || [])
                .map(
                  (winnerId) =>
                    roomState.room.players.find((player) => player.id === winnerId)?.name || "Unknown",
                )
                .join(", ")}
            </p>
            <ul className="score-list">
              {Object.entries(round.distancesKm || {})
                .sort(([, distA], [, distB]) => distA - distB)
                .map(([playerId, distanceKm]) => {
                  const playerName =
                    roomState.room.players.find((player) => player.id === playerId)?.name || "Unknown";
                  const isWinner = (round.winners || []).includes(playerId);
                  return (
                    <li key={playerId}>
                      <span>
                        {playerName}
                        {isWinner ? " (point)" : ""}
                      </span>
                      <strong>{distanceKm.toFixed(2)} km</strong>
                    </li>
                  );
                })}
            </ul>
            <button type="button" onClick={onNextMapRound} disabled={!isHost}>
              {isHost
                ? round.promptIndex < round.promptTotal - 1
                  ? "Next clue"
                  : "Finish"
                : "Waiting for host"}
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

function RevealCopy({ round }) {
  const step = round.revealSteps[round.revealIndex];
  if (!step) {
    return <p className="subtle">Waiting for reveal to start.</p>;
  }

  if (step.type === "player") {
    return (
      <p className="subtle">
        <strong>{step.playerName}</strong> guessed here.
      </p>
    );
  }

  return (
    <p className="subtle">
      Correct location for <strong>{step.locationName}</strong>.
    </p>
  );
}
