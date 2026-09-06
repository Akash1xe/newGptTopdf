export type PdfTheme = "light" | "dark";
export type PageSize = "A4" | "Letter";
export type MessageFilter = "all" | "user" | "assistant";
export type MarginPreset = "compact" | "normal" | "comfortable";
export type CodeTheme = "light" | "dark";

export interface ExportPreferences {
  pdfTheme: PdfTheme;
  pageSize: PageSize;
  messageFilter: MessageFilter;
  includeTitle: boolean;
  includeExportDate: boolean;
  includeSourceUrl: boolean;
  codeTheme: CodeTheme;
  wrapCode: boolean;
  showCodeLanguage: boolean;
  marginPreset: MarginPreset;
}

export const DEFAULT_EXPORT_PREFERENCES: ExportPreferences = {
  pdfTheme: "light",
  pageSize: "A4",
  messageFilter: "all",
  includeTitle: true,
  includeExportDate: true,
  includeSourceUrl: false,
  codeTheme: "light",
  wrapCode: true,
  showCodeLanguage: true,
  marginPreset: "normal"
};
