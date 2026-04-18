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
  SUBMIT_TOTES_EMOJI_CLUE: "submit_totes_emoji_clue",
  SUBMIT_TOTES_EMOJI_TITLE_GUESS: "submit_totes_emoji_title_guess",
  REROLL_TOTES_EMOJI_TITLE: "reroll_totes_emoji_title",
  SUBMIT_NICE_ROUND_CLUE: "submit_nice_round_clue",
  SUBMIT_NICE_ROUND_TITLE_GUESS: "submit_nice_round_title_guess",
  SUBMIT_NICE_ROUND_BEST_CLUE: "submit_nice_round_best_clue",
  SUBMIT_JOKER_SETUP: "submit_joker_setup",
  SUBMIT_JOKER_PUNCHLINE: "submit_joker_punchline",
  NEXT_JOKER_REVEAL: "next_joker_reveal",
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
  TOTES_EMOJI_ENTRY: "totes_emoji_entry",
  TOTES_EMOJI_GUESSING: "totes_emoji_guessing",
  NICE_ROUND_CLUES: "nice_round_clues",
  NICE_ROUND_GUESSING: "nice_round_guessing",
  NICE_ROUND_PICK_BEST: "nice_round_pick_best",
  JOKER_SETUPS: "joker_setups",
  JOKER_PUNCHLINES: "joker_punchlines",
  JOKER_REVEAL: "joker_reveal",
};

export const GAME_TYPE = {
  AND_THE_ANSWER_ISNT: "and_the_answer_isnt",
  DISTINCTLY_AVERAGE: "distinctly_average",
  IM_TERRIBLE_AT_DATING: "im_terrible_at_dating",
  WHERE_IS_KAZAKHSTAN: "where_is_kazakhstan",
  TOTES_EMOJI: "totes_emoji",
  NICE_ROUND: "nice_round",
  JOKER: "joker",
};
