import { DEFAULT_EXPORT_PREFERENCES, type CustomMargins, type ExportPreferences, type MarginPreset } from "../types/preferences";

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

function boundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizeMargins(value: unknown): CustomMargins {
  const source = value && typeof value === "object" ? value as Partial<CustomMargins> : {};
  const fallback = DEFAULT_EXPORT_PREFERENCES.customMargins;
  return {
    top: boundedNumber(source.top, 5, 40, fallback.top),
    right: boundedNumber(source.right, 5, 40, fallback.right),
    bottom: boundedNumber(source.bottom, 5, 40, fallback.bottom),
    left: boundedNumber(source.left, 5, 40, fallback.left)
  };
}

function normalizeMarginPreset(value: unknown): MarginPreset {
  // "comfortable" was the previous widest preset; migrate it to the new "wide" option.
  if (value === "comfortable") return "wide";
  return enumValue(value, ["compact", "normal", "wide", "custom"] as const, DEFAULT_EXPORT_PREFERENCES.marginPreset);
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
    marginPreset: normalizeMarginPreset(value.marginPreset),
    customMargins: normalizeMargins(value.customMargins),
    messagePadding: enumValue(value.messagePadding, ["compact", "normal", "spacious"] as const, DEFAULT_EXPORT_PREFERENCES.messagePadding),
    messageSpacing: enumValue(value.messageSpacing, ["compact", "normal", "spacious"] as const, DEFAULT_EXPORT_PREFERENCES.messageSpacing),
    paragraphSpacing: enumValue(value.paragraphSpacing, ["compact", "normal", "spacious"] as const, DEFAULT_EXPORT_PREFERENCES.paragraphSpacing),
    lineSpacing: enumValue(value.lineSpacing, ["compact", "normal", "relaxed"] as const, DEFAULT_EXPORT_PREFERENCES.lineSpacing),
    bodyFontFamily: enumValue(value.bodyFontFamily, ["system", "arial", "georgia", "times", "verdana", "tahoma", "trebuchet"] as const, DEFAULT_EXPORT_PREFERENCES.bodyFontFamily),
    bodyFontSize: boundedNumber(value.bodyFontSize, 9, 18, DEFAULT_EXPORT_PREFERENCES.bodyFontSize),
    textWeight: enumValue(value.textWeight, ["light", "regular", "medium", "semibold"] as const, DEFAULT_EXPORT_PREFERENCES.textWeight),
    codeFontSize: boundedNumber(value.codeFontSize, 8, 16, DEFAULT_EXPORT_PREFERENCES.codeFontSize)
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
  const preferences = { ...DEFAULT_EXPORT_PREFERENCES, customMargins: { ...DEFAULT_EXPORT_PREFERENCES.customMargins } };
  await saveExportPreferences(preferences);
  return preferences;
}
