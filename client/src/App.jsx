import { useEffect, useMemo, useRef, useState } from "react";
import { connectToRoom } from "./lib/socket";
import { GamePage } from "./pages/GamePage";
import { JoinPage } from "./pages/JoinPage";
import { LobbyPage } from "./pages/LobbyPage";

const STORAGE_KEYS = {
  playerName: "hog.playerName",
  roomName: "hog.roomName",
  sessionId: "hog.sessionId",
};

function getStoredValue(key) {
  return window.localStorage.getItem(key) || "";
}

function getSessionId() {
  let sessionId = window.sessionStorage.getItem(STORAGE_KEYS.sessionId);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
  }

  return sessionId;
}

export default function App() {
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState("");
  const [joinDefaults, setJoinDefaults] = useState({
    playerName: getStoredValue(STORAGE_KEYS.playerName),
    roomName: getStoredValue(STORAGE_KEYS.roomName),
  });
  const connectionRef = useRef(null);

  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
    };
  }, []);

  const view = useMemo(() => {
    if (!roomState) {
      return "join";
    }

    if (!roomState.game) {
      return "lobby";
    }

    return "game";
  }, [roomState]);

  function handleJoin({ playerName, roomName }) {
    const trimmedName = playerName.trim();
    const trimmedRoom = roomName.trim();

    setError("");

    if (!trimmedName || !trimmedRoom) {
      setError("Enter both a name and a room.");
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.playerName, trimmedName);
    window.localStorage.setItem(STORAGE_KEYS.roomName, trimmedRoom);
    setJoinDefaults({ playerName: trimmedName, roomName: trimmedRoom });

    connectionRef.current?.disconnect();
    connectionRef.current = connectToRoom({
      playerName: trimmedName,
      roomName: trimmedRoom,
      sessionId: getSessionId(),
      onRoomState: (nextRoomState) => {
        setError("");
        setRoomState(nextRoomState);
      },
      onError: (message) => {
        setError(message);
      },
    });
  }

  if (view === "join") {
    return (
      <JoinPage
        initialName={joinDefaults.playerName}
        initialRoom={joinDefaults.roomName}
        onJoin={handleJoin}
        error={error}
      />
    );
  }

  if (view === "lobby") {
    return (
      <>
        {error ? <p className="floating-error">{error}</p> : null}
        <LobbyPage
          roomState={roomState}
          onStartGame={(gameType) => connectionRef.current?.startGame(gameType)}
        />
      </>
    );
  }

  return (
    <>
      {error ? <p className="floating-error">{error}</p> : null}
      <GamePage
        roomState={roomState}
        onSubmitFakeAnswer={(answer) => connectionRef.current?.submitFakeAnswer(answer)}
        onSubmitGuess={(optionId) => connectionRef.current?.submitGuess(optionId)}
        onSubmitDistinctlyAverageGuess={(guess) =>
          connectionRef.current?.submitDistinctlyAverageGuess(guess)
        }
        onSubmitImTerribleAtDatingGuess={(guess) =>
          connectionRef.current?.submitImTerribleAtDatingGuess(guess)
        }
        onSubmitMapGuess={(guess) => connectionRef.current?.submitMapGuess(guess)}
        onNextMapRevealStep={() => connectionRef.current?.nextMapRevealStep()}
        onNextMapRound={() => connectionRef.current?.nextMapRound()}
        onNextRound={() => connectionRef.current?.nextRound()}
        onSubmitTotesEmojiClue={(emoji) => connectionRef.current?.submitTotesEmojiClue(emoji)}
        onSubmitTotesEmojiTitleGuess={(title) =>
          connectionRef.current?.submitTotesEmojiTitleGuess(title)
        }
        onRerollTotesEmojiTitle={() => connectionRef.current?.rerollTotesEmojiTitle()}
        onSubmitNiceRoundClue={(word) => connectionRef.current?.submitNiceRoundClue(word)}
        onSubmitNiceRoundTitleGuess={(title) => connectionRef.current?.submitNiceRoundTitleGuess(title)}
        onSubmitNiceRoundBestClue={(pickedPlayerId) =>
          connectionRef.current?.submitNiceRoundBestClue(pickedPlayerId)
        }
        onReturnToLobby={() => connectionRef.current?.returnToLobby()}
      />
    </>
  );
}
