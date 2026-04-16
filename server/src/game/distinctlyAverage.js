import { GAME_TYPE } from "shared";
import { createNumericTeamAverageMinigame } from "./numericTeamAverageGame.js";

export function createDistinctlyAverageMinigame({ questions }) {
  return createNumericTeamAverageMinigame({
    questions,
    gameType: GAME_TYPE.DISTINCTLY_AVERAGE,
    name: "Distinctly Average",
    description: "Teams answer numerical questions. Closest team average wins the point.",
  });
}
