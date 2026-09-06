import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/types/preferences";
import { getExportPreferences, normalizeExportPreferences, resetExportPreferences, saveExportPreferences } from "../src/services/settingsService";

const memory: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(memory)) delete memory[key];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: memory[key] }),
        set: async (value: Record<string, unknown>) => { Object.assign(memory, value); }
      }
    }
  });
});

describe("export preference storage", () => {
  it("normalizes invalid and partial settings", () => {
    const value = normalizeExportPreferences({ pageSize: "Letter", pdfTheme: "wrong" as never, includeSourceUrl: true });
    expect(value.pageSize).toBe("Letter");
    expect(value.pdfTheme).toBe("light");
    expect(value.includeSourceUrl).toBe(true);
    expect(value.wrapCode).toBe(true);
    expect(value.excludeUserMessages).toBe(false);
  });

  it("migrates older assistant-only preferences to exclude my prompts", () => {
    const value = normalizeExportPreferences({ messageFilter: "assistant" });
    expect(value.messageFilter).toBe("assistant");
    expect(value.excludeUserMessages).toBe(true);
  });

  it("persists and reloads exclude my prompts", async () => {
    const changed = {
      ...DEFAULT_EXPORT_PREFERENCES,
      pageSize: "Letter" as const,
      messageFilter: "assistant" as const,
      excludeUserMessages: true
    };
    await saveExportPreferences(changed);
    expect(await getExportPreferences()).toEqual(changed);
  });

  it("resets exclude my prompts to off", async () => {
    await saveExportPreferences({
      ...DEFAULT_EXPORT_PREFERENCES,
      pdfTheme: "dark",
      messageFilter: "assistant",
      excludeUserMessages: true
    });
    expect(await resetExportPreferences()).toEqual(DEFAULT_EXPORT_PREFERENCES);
    expect((await getExportPreferences()).excludeUserMessages).toBe(false);
  });
});
