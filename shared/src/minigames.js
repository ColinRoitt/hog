import { GAME_TYPE } from "./events.js";

export const MINIGAME_DEFINITIONS = [
  {
    type: GAME_TYPE.AND_THE_ANSWER_ISNT,
    name: "And the Answer Isn't",
    description: "One player guesses the real answer while everyone else submits bluffs.",
    lobbySection: "hog",
  },
  {
    type: GAME_TYPE.DISTINCTLY_AVERAGE,
    name: "Distinctly Average",
    description: "Teams answer numerical questions. Closest team average wins the point.",
    lobbySection: "hog",
  },
  {
    type: GAME_TYPE.IM_TERRIBLE_AT_DATING,
    name: "I'm Terrible at Dating",
    description:
      "Guess when each event happened. Closest year wins the point (BC answers are negative numbers).",
    lobbySection: "hog",
  },
  {
    type: GAME_TYPE.WHERE_IS_KAZAKHSTAN,
    name: "Where is Kazakhstan?",
    description: "Drop a pin on the map. Closest guess wins the point (ties within 15% of best).",
    lobbySection: "hog",
  },
  {
    type: GAME_TYPE.TOTES_EMOJI,
    name: "Totes Emoji",
    description:
      "Describe a random TV show, movie, or book using only emoji, then guess what everyone else's emoji mean.",
    lobbySection: "hog",
  },
  {
    type: GAME_TYPE.NICE_ROUND,
    name: "The Nice Round",
    description:
      "One player guesses a title while everyone else enters one-word clues at the same time. Guess right, then pick who had the best clue for bonus points.",
    lobbySection: "hog",
  },
  {
    type: GAME_TYPE.JOKER,
    name: "Joker",
    description:
      "Everyone writes a joke setup, then gets someone else's to punch up. Reveal setups and punchlines to the room.",
    lobbySection: "parlour",
  },
];

export const DEFAULT_GAME_TYPE = MINIGAME_DEFINITIONS[0].type;
