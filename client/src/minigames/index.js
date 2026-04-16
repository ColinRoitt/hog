import { GAME_TYPE } from "shared";
import { AndTheAnswerIsntGameView } from "./andTheAnswerIsnt/GameView";
import { DistinctlyAverageGameView } from "./distinctlyAverage/GameView";
import { WhereIsKazakhstanGameView } from "./whereIsKazakhstan/GameView";

export const gameViewsByType = {
  [GAME_TYPE.AND_THE_ANSWER_ISNT]: AndTheAnswerIsntGameView,
  [GAME_TYPE.DISTINCTLY_AVERAGE]: DistinctlyAverageGameView,
  [GAME_TYPE.WHERE_IS_KAZAKHSTAN]: WhereIsKazakhstanGameView,
};
