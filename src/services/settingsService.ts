import { DEFAULT_EXPORT_PREFERENCES, type ExportPreferences } from "../types/preferences";

const STORAGE_KEY = "exportPreferencesV1";
const STORAGE_VERSION = 1;

interface StoredPreferences {
  version: number;
  preferences: Partial<ExportPreferences>;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeExportPreferences(input?: Partial<ExportPreferences> | null): ExportPreferences {
  const value = input ?? {};
  const messageFilter = enumValue(value.messageFilter, ["all", "user", "assistant"] as const, DEFAULT_EXPORT_PREFERENCES.messageFilter);
  return {
    pdfTheme: enumValue(value.pdfTheme, ["light", "dark"] as const, DEFAULT_EXPORT_PREFERENCES.pdfTheme),
    pageSize: enumValue(value.pageSize, ["A4", "Letter"] as const, DEFAULT_EXPORT_PREFERENCES.pageSize),
    messageFilter,
    // Preserve the intent of older stored "assistant only" preferences that predate this explicit toggle.
    excludeUserMessages: boolValue(value.excludeUserMessages, messageFilter === "assistant"),
    includeTitle: boolValue(value.includeTitle, DEFAULT_EXPORT_PREFERENCES.includeTitle),
    includeExportDate: boolValue(value.includeExportDate, DEFAULT_EXPORT_PREFERENCES.includeExportDate),
    includeSourceUrl: boolValue(value.includeSourceUrl, DEFAULT_EXPORT_PREFERENCES.includeSourceUrl),
    codeTheme: enumValue(value.codeTheme, ["light", "dark"] as const, DEFAULT_EXPORT_PREFERENCES.codeTheme),
    wrapCode: boolValue(value.wrapCode, DEFAULT_EXPORT_PREFERENCES.wrapCode),
    showCodeLanguage: boolValue(value.showCodeLanguage, DEFAULT_EXPORT_PREFERENCES.showCodeLanguage),
    marginPreset: enumValue(value.marginPreset, ["compact", "normal", "comfortable"] as const, DEFAULT_EXPORT_PREFERENCES.marginPreset)
  };
}

export async function getExportPreferences(): Promise<ExportPreferences> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as StoredPreferences | undefined;
  if (!stored || stored.version !== STORAGE_VERSION) return normalizeExportPreferences(stored?.preferences);
  return normalizeExportPreferences(stored.preferences);
}

export async function saveExportPreferences(preferences: ExportPreferences): Promise<void> {
  const stored: StoredPreferences = { version: STORAGE_VERSION, preferences: normalizeExportPreferences(preferences) };
  await chrome.storage.local.set({ [STORAGE_KEY]: stored });
}

export async function resetExportPreferences(): Promise<ExportPreferences> {
  const preferences = { ...DEFAULT_EXPORT_PREFERENCES };
  await saveExportPreferences(preferences);
  return preferences;
}
