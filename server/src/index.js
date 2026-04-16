import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";
import { createAndTheAnswerIsntMinigame } from "./game/andTheAnswerIsnt.js";
import { createDistinctlyAverageMinigame } from "./game/distinctlyAverage.js";
import { createImTerribleAtDatingMinigame } from "./game/imTerribleAtDating.js";
import { createWhereIsKazakhstanMinigame } from "./game/whereIsKazakhstan.js";
import { createMinigameRegistry } from "./game/minigameRegistry.js";
import { createRoomStore } from "./rooms/roomStore.js";
import { createRoomGateway } from "./socket/roomGateway.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3001);

const andTheAnswerIsntQuestionsPath = path.join(__dirname, "questions", "andTheAnswerIsntQuestions.json");
const andTheAnswerIsntQuestionsQuestions = JSON.parse(fs.readFileSync(andTheAnswerIsntQuestionsPath, "utf8"));
const distinctlyAverageQuestionsPath = path.join(
  __dirname,
  "questions",
  "distinctlyAverageQuestions.json",
);
const distinctlyAverageQuestions = JSON.parse(
  fs.readFileSync(distinctlyAverageQuestionsPath, "utf8"),
);
const imTerribleAtDatingQuestionsPath = path.join(
  __dirname,
  "questions",
  "imTerribleAtDatingQuestions.json",
);
const imTerribleAtDatingQuestions = JSON.parse(fs.readFileSync(imTerribleAtDatingQuestionsPath, "utf8"));
const whereIsKazakhstanQuestionsPath = path.join(
  __dirname,
  "questions",
  "whereIsKazakhstanQuestions.json",
);
const whereIsKazakhstanQuestions = JSON.parse(fs.readFileSync(whereIsKazakhstanQuestionsPath, "utf8"));

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

const clientDistPath = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get(/^\/(?!health$).*/, (_request, response) => {
    response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
const minigameRegistry = createMinigameRegistry([
  createAndTheAnswerIsntMinigame({ questions: andTheAnswerIsntQuestionsQuestions }),
  createDistinctlyAverageMinigame({ questions: distinctlyAverageQuestions }),
  createImTerribleAtDatingMinigame({ questions: imTerribleAtDatingQuestions }),
  createWhereIsKazakhstanMinigame({ questions: whereIsKazakhstanQuestions }),
]);
const roomStore = createRoomStore({ minigameRegistry });

createRoomGateway({
  wss,
  roomStore,
  minigameRegistry,
});
