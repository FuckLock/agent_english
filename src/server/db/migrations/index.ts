import { contentStatements } from "./0001-content";
import { gameStatements } from "./0001-game";
import { providerStatements } from "./0001-providers";

export const migrations = [
  {
    id: "0001_initial_local_learning_store",
    statements: [...providerStatements, ...contentStatements, ...gameStatements]
  }
] as const;
