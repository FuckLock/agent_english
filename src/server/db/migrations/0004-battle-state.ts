export const battleStateStatements = [
  `ALTER TABLE battle_sessions ADD COLUMN combo_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE battle_sessions ADD COLUMN monster_state TEXT NOT NULL DEFAULT 'normal'`,
  `ALTER TABLE battle_sessions ADD COLUMN rescue_pending INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE battle_turns ADD COLUMN damage INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE battle_turns ADD COLUMN hit_type TEXT NOT NULL DEFAULT 'miss'`,
  `ALTER TABLE battle_turns ADD COLUMN combo_after INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE battle_turns ADD COLUMN monster_state_after TEXT NOT NULL DEFAULT 'normal'`,
  `ALTER TABLE battle_turns ADD COLUMN rescue_used_this_round INTEGER NOT NULL DEFAULT 0`
];
