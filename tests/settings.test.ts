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
  it("normalizes invalid and partial settings with appearance defaults", () => {
    const value = normalizeExportPreferences({ pageSize: "Letter", pdfTheme: "wrong" as never, includeSourceUrl: true });
    expect(value.pageSize).toBe("Letter");
    expect(value.pdfTheme).toBe("light");
    expect(value.includeSourceUrl).toBe(true);
    expect(value.wrapCode).toBe(true);
    expect(value.excludeUserMessages).toBe(false);
    expect(value.marginPreset).toBe("normal");
    expect(value.customMargins).toEqual({ top: 15, right: 15, bottom: 15, left: 15 });
    expect(value.bodyFontFamily).toBe("system");
    expect(value.bodyFontSize).toBe(11);
    expect(value.textWeight).toBe("regular");
    expect(value.codeFontSize).toBe(10);
    expect(value.lineSpacing).toBe("normal");
  });

  it("migrates older assistant-only and comfortable-margin preferences", () => {
    const value = normalizeExportPreferences({ messageFilter: "assistant", marginPreset: "comfortable" as never });
    expect(value.messageFilter).toBe("assistant");
    expect(value.excludeUserMessages).toBe(true);
    expect(value.marginPreset).toBe("wide");
    expect(value.textWeight).toBe("regular");
  });

  it("clamps unsafe typography and custom margin values", () => {
    const value = normalizeExportPreferences({
      bodyFontFamily: "bad-font; color:red" as never,
      bodyFontSize: 1000,
      textWeight: "900; color:red" as never,
      codeFontSize: -5,
      marginPreset: "custom",
      customMargins: { top: -10, right: 100, bottom: 12, left: 16 }
    });
    expect(value.bodyFontFamily).toBe("system");
    expect(value.bodyFontSize).toBe(18);
    expect(value.textWeight).toBe("regular");
    expect(value.codeFontSize).toBe(8);
    expect(value.customMargins).toEqual({ top: 5, right: 40, bottom: 12, left: 16 });
  });

  it("accepts each supported text thickness", () => {
    expect(normalizeExportPreferences({ textWeight: "light" }).textWeight).toBe("light");
    expect(normalizeExportPreferences({ textWeight: "regular" }).textWeight).toBe("regular");
    expect(normalizeExportPreferences({ textWeight: "medium" }).textWeight).toBe("medium");
    expect(normalizeExportPreferences({ textWeight: "semibold" }).textWeight).toBe("semibold");
  });

  it("persists and reloads layout, typography and exclude-my-prompts settings", async () => {
    const changed = {
      ...DEFAULT_EXPORT_PREFERENCES,
      pageSize: "Letter" as const,
      messageFilter: "assistant" as const,
      excludeUserMessages: true,
      marginPreset: "custom" as const,
      customMargins: { top: 10, right: 12, bottom: 14, left: 16 },
      messagePadding: "spacious" as const,
      messageSpacing: "compact" as const,
      paragraphSpacing: "spacious" as const,
      lineSpacing: "relaxed" as const,
      bodyFontFamily: "georgia" as const,
      bodyFontSize: 14,
      textWeight: "semibold" as const,
      codeFontSize: 12
    };
    await saveExportPreferences(changed);
    expect(await getExportPreferences()).toEqual(changed);
  });

  it("resets all appearance settings and exclude-my-prompts to defaults", async () => {
    await saveExportPreferences({
      ...DEFAULT_EXPORT_PREFERENCES,
      pdfTheme: "dark",
      messageFilter: "assistant",
      excludeUserMessages: true,
      marginPreset: "wide",
      bodyFontFamily: "times",
      bodyFontSize: 18,
      textWeight: "semibold",
      codeFontSize: 16,
      lineSpacing: "relaxed"
    });
    expect(await resetExportPreferences()).toEqual(DEFAULT_EXPORT_PREFERENCES);
    const restored = await getExportPreferences();
    expect(restored.excludeUserMessages).toBe(false);
    expect(restored.bodyFontFamily).toBe("system");
    expect(restored.bodyFontSize).toBe(11);
    expect(restored.textWeight).toBe("regular");
    expect(restored.marginPreset).toBe("normal");
  });
});
