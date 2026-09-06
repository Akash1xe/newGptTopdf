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
    expect(value.customTextWeight).toBe(400);
    expect(value.codeFontSize).toBe(10);
    expect(value.lineSpacing).toBe("normal");
  });

  it("migrates older assistant-only, comfortable-margin and pre-custom thickness preferences", () => {
    const value = normalizeExportPreferences({ messageFilter: "assistant", marginPreset: "comfortable" as never, textWeight: "medium" });
    expect(value.messageFilter).toBe("assistant");
    expect(value.excludeUserMessages).toBe(true);
    expect(value.marginPreset).toBe("wide");
    expect(value.textWeight).toBe("medium");
    expect(value.customTextWeight).toBe(400);
  });

  it("clamps unsafe typography, custom thickness and custom margin values", () => {
    const value = normalizeExportPreferences({
      bodyFontFamily: "bad-font; color:red" as never,
      bodyFontSize: 1000,
      textWeight: "900; color:red" as never,
      customTextWeight: 5000,
      codeFontSize: -5,
      marginPreset: "custom",
      customMargins: { top: -10, right: 100, bottom: 12, left: 16 }
    });
    expect(value.bodyFontFamily).toBe("system");
    expect(value.bodyFontSize).toBe(18);
    expect(value.textWeight).toBe("regular");
    expect(value.customTextWeight).toBe(800);
    expect(value.codeFontSize).toBe(8);
    expect(value.customMargins).toEqual({ top: 5, right: 40, bottom: 12, left: 16 });

    expect(normalizeExportPreferences({ customTextWeight: -100 }).customTextWeight).toBe(100);
    expect(normalizeExportPreferences({ customTextWeight: Number.NaN }).customTextWeight).toBe(400);
  });

  it("accepts every supported text thickness preset including custom", () => {
    expect(normalizeExportPreferences({ textWeight: "light" }).textWeight).toBe("light");
    expect(normalizeExportPreferences({ textWeight: "regular" }).textWeight).toBe("regular");
    expect(normalizeExportPreferences({ textWeight: "medium" }).textWeight).toBe("medium");
    expect(normalizeExportPreferences({ textWeight: "semibold" }).textWeight).toBe("semibold");
    expect(normalizeExportPreferences({ textWeight: "bold" }).textWeight).toBe("bold");
    expect(normalizeExportPreferences({ textWeight: "extrabold" }).textWeight).toBe("extrabold");
    const custom = normalizeExportPreferences({ textWeight: "custom", customTextWeight: 550 });
    expect(custom.textWeight).toBe("custom");
    expect(custom.customTextWeight).toBe(550);
  });

  it("persists custom thickness with layout, typography and exclude-my-prompts settings", async () => {
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
      textWeight: "custom" as const,
      customTextWeight: 550,
      codeFontSize: 12
    };
    await saveExportPreferences(changed);
    expect(await getExportPreferences()).toEqual(changed);
  });

  it("preserves the custom thickness value while a preset is selected", async () => {
    await saveExportPreferences({ ...DEFAULT_EXPORT_PREFERENCES, textWeight: "custom", customTextWeight: 550 });
    const custom = await getExportPreferences();
    await saveExportPreferences({ ...custom, textWeight: "regular" });
    const preset = await getExportPreferences();
    expect(preset.textWeight).toBe("regular");
    expect(preset.customTextWeight).toBe(550);
    await saveExportPreferences({ ...preset, textWeight: "custom" });
    expect((await getExportPreferences()).customTextWeight).toBe(550);
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
      textWeight: "custom",
      customTextWeight: 650,
      codeFontSize: 16,
      lineSpacing: "relaxed"
    });
    expect(await resetExportPreferences()).toEqual(DEFAULT_EXPORT_PREFERENCES);
    const restored = await getExportPreferences();
    expect(restored.excludeUserMessages).toBe(false);
    expect(restored.bodyFontFamily).toBe("system");
    expect(restored.bodyFontSize).toBe(11);
    expect(restored.textWeight).toBe("regular");
    expect(restored.customTextWeight).toBe(400);
    expect(restored.marginPreset).toBe("normal");
  });
});
