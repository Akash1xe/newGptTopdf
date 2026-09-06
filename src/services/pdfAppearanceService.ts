import type { BodyFontFamily, ExportPreferences, SpacingPreset } from "../types/preferences";

export interface ResolvedPdfAppearance {
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  messagePadding: string;
  messageSpacing: string;
  paragraphSpacing: string;
  lineHeight: string;
  bodyFontFamily: string;
  bodyFontSize: string;
  codeFontSize: string;
}

const FONT_STACKS: Record<BodyFontFamily, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Arial, sans-serif',
  trebuchet: '"Trebuchet MS", Arial, sans-serif'
};

const MESSAGE_PADDING: Record<SpacingPreset, string> = {
  compact: "4px",
  normal: "9px",
  spacious: "15px"
};

const MESSAGE_SPACING: Record<SpacingPreset, string> = {
  compact: "10px",
  normal: "20px",
  spacious: "30px"
};

const PARAGRAPH_SPACING: Record<SpacingPreset, string> = {
  compact: "0.35em",
  normal: "0.65em",
  spacious: "1em"
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function spacingValue<T extends string>(value: unknown, map: Record<T, string>, fallback: T): string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value) ? map[value as T] : map[fallback];
}

function fontStack(value: unknown): string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FONT_STACKS, value)
    ? FONT_STACKS[value as BodyFontFamily]
    : FONT_STACKS.system;
}

function margins(preferences: ExportPreferences): [number, number, number, number] {
  if (preferences.marginPreset === "compact") return [8, 10, 8, 10];
  if (preferences.marginPreset === "wide") return [22, 24, 22, 24];
  if (preferences.marginPreset === "custom") {
    const value = preferences.customMargins ?? { top: 15, right: 15, bottom: 15, left: 15 };
    return [
      clampNumber(value.top, 5, 40, 15),
      clampNumber(value.right, 5, 40, 15),
      clampNumber(value.bottom, 5, 40, 15),
      clampNumber(value.left, 5, 40, 15)
    ];
  }
  return [15, 15, 15, 15];
}

export function resolvePdfAppearance(preferences: ExportPreferences): ResolvedPdfAppearance {
  const [top, right, bottom, left] = margins(preferences);
  const lineHeight = preferences.lineSpacing === "compact" ? "1.35" : preferences.lineSpacing === "relaxed" ? "1.7" : "1.5";
  return {
    marginTop: `${top}mm`,
    marginRight: `${right}mm`,
    marginBottom: `${bottom}mm`,
    marginLeft: `${left}mm`,
    messagePadding: spacingValue(preferences.messagePadding, MESSAGE_PADDING, "normal"),
    messageSpacing: spacingValue(preferences.messageSpacing, MESSAGE_SPACING, "normal"),
    paragraphSpacing: spacingValue(preferences.paragraphSpacing, PARAGRAPH_SPACING, "normal"),
    lineHeight,
    bodyFontFamily: fontStack(preferences.bodyFontFamily),
    bodyFontSize: `${clampNumber(preferences.bodyFontSize, 9, 18, 11)}pt`,
    codeFontSize: `${clampNumber(preferences.codeFontSize, 8, 16, 10)}pt`
  };
}

export function getBodyFontStack(font: BodyFontFamily): string {
  return FONT_STACKS[font];
}
