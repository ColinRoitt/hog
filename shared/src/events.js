export const CLIENT_EVENTS = {
  JOIN_ROOM: "join_room",
  START_GAME: "start_game",
  NEXT_ROUND: "next_round",
  NEXT_MAP_REVEAL_STEP: "next_map_reveal_step",
  NEXT_MAP_ROUND: "next_map_round",
  RETURN_TO_LOBBY: "return_to_lobby",
  SUBMIT_DISTINCTLY_AVERAGE_GUESS: "submit_distinctly_average_guess",
  SUBMIT_IM_TERRIBLE_AT_DATING_GUESS: "submit_im_terrible_at_dating_guess",
  SUBMIT_MAP_GUESS: "submit_map_guess",
  SUBMIT_FAKE_ANSWER: "submit_fake_answer",
  SUBMIT_GUESS: "submit_guess",
};

export const SERVER_EVENTS = {
  CONNECTED: "connected",
  ROOM_STATE: "room_state",
  ERROR: "error",
};

export const GAME_PHASES = {
  LOBBY: "lobby",
  COLLECTING_FAKE_ANSWERS: "collecting_fake_answers",
  GUESSING: "guessing",
  REVEAL: "reveal",
  FINISHED: "finished",
  MAP_PLACING: "map_placing",
  MAP_REVEAL: "map_reveal",
  MAP_SCORING: "map_scoring",
};

export const GAME_TYPE = {
  AND_THE_ANSWER_ISNT: "and_the_answer_isnt",
  DISTINCTLY_AVERAGE: "distinctly_average",
  IM_TERRIBLE_AT_DATING: "im_terrible_at_dating",
  WHERE_IS_KAZAKHSTAN: "where_is_kazakhstan",
};
