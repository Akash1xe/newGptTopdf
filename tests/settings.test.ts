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
  });

  it("persists and reloads settings", async () => {
    const changed = { ...DEFAULT_EXPORT_PREFERENCES, pageSize: "Letter" as const, messageFilter: "assistant" as const };
    await saveExportPreferences(changed);
    expect(await getExportPreferences()).toEqual(changed);
  });

  it("resets to defaults", async () => {
    await saveExportPreferences({ ...DEFAULT_EXPORT_PREFERENCES, pdfTheme: "dark" });
    expect(await resetExportPreferences()).toEqual(DEFAULT_EXPORT_PREFERENCES);
    expect(await getExportPreferences()).toEqual(DEFAULT_EXPORT_PREFERENCES);
  });
});
