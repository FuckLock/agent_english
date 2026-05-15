import { contentStatements } from "./0001-content";
import { gameStatements } from "./0001-game";
import { providerStatements } from "./0001-providers";
import { v16ContentStatements } from "./0002-v16-content";
import { prologueStatements } from "./0003-prologue";

export const migrations = [
  {
    id: "0001_initial_local_learning_store",
    statements: [...providerStatements, ...contentStatements, ...gameStatements]
  },
  {
    id: "0002_v16_content_visual_fields",
    statements: v16ContentStatements
  },
  {
    id: "0003_prologue_dungeon_flag",
    statements: prologueStatements
  }
] as const;
