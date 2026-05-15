import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";

export const UI_PREFERENCES_KEY = "ui_preferences";
export const UI_PREFERENCES_ROW_ID = "settings-ui-preferences";

export type UiPreferences = {
  audioEnabled: boolean;
  audioConfirmed: boolean;
  reduceMotion: boolean;
  lowImage: boolean;
};

const DEFAULTS: UiPreferences = {
  audioEnabled: false,
  audioConfirmed: false,
  reduceMotion: false,
  lowImage: false
};

export function getUiPreferences(): UiPreferences {
  const row = getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, UI_PREFERENCES_KEY))
    .get();
  if (!row) return DEFAULTS;
  try {
    const parsed = JSON.parse(row.valueJson) as Partial<UiPreferences>;
    return {
      audioEnabled: typeof parsed.audioEnabled === "boolean" ? parsed.audioEnabled : DEFAULTS.audioEnabled,
      audioConfirmed: typeof parsed.audioConfirmed === "boolean" ? parsed.audioConfirmed : DEFAULTS.audioConfirmed,
      reduceMotion: typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : DEFAULTS.reduceMotion,
      lowImage: typeof parsed.lowImage === "boolean" ? parsed.lowImage : DEFAULTS.lowImage
    };
  } catch {
    return DEFAULTS;
  }
}

export function updateUiPreferences(update: Partial<UiPreferences>): UiPreferences {
  const current = getUiPreferences();
  const next: UiPreferences = { ...current, ...update };
  const timestamp = nowIso();
  const valueJson = asJson(next as unknown as Record<string, unknown>);

  getDb()
    .insert(appSettings)
    .values({
      id: UI_PREFERENCES_ROW_ID,
      key: UI_PREFERENCES_KEY,
      valueJson,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { valueJson, updatedAt: timestamp }
    })
    .run();

  return next;
}

export function getBodyClassFromPreferences(prefs: UiPreferences): string {
  const tokens: string[] = [];
  if (prefs.reduceMotion) tokens.push("reduce-motion");
  if (prefs.lowImage) tokens.push("low-image");
  if (!prefs.audioEnabled) tokens.push("muted");
  if (!prefs.audioConfirmed) tokens.push("audio-pending");
  return tokens.join(" ");
}
