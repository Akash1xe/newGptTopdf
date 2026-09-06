import type { ExportPreferences, MessageFilter } from "../../types/preferences";
import { SelectField } from "./SelectField";
import { ToggleField } from "./ToggleField";

interface Props {
  preferences: ExportPreferences;
  onChange(next: ExportPreferences): void;
  advanced: boolean;
  onToggleAdvanced(): void;
  onReset(): void;
}

export function ExportSettings({ preferences, onChange, advanced, onToggleAdvanced, onReset }: Props) {
  const patch = <K extends keyof ExportPreferences>(key: K, value: ExportPreferences[K]) => onChange({ ...preferences, [key]: value });

  const setExcludeUserMessages = (checked: boolean) => {
    onChange({
      ...preferences,
      excludeUserMessages: checked,
      // Keep the existing role filter synchronized so older and advanced settings remain predictable.
      messageFilter: checked ? "assistant" : (preferences.messageFilter === "assistant" ? "all" : preferences.messageFilter)
    });
  };

  const setMessageFilter = (value: MessageFilter) => {
    onChange({
      ...preferences,
      messageFilter: value,
      excludeUserMessages: value === "assistant"
    });
  };

  return (
    <section className="settings-card">
      <div className="section-title"><strong>Export</strong><span>PDF preferences</span></div>
      <SelectField label="Theme" value={preferences.pdfTheme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={(value) => patch("pdfTheme", value)} />
      <SelectField label="Page size" value={preferences.pageSize} options={[{ value: "A4", label: "A4" }, { value: "Letter", label: "Letter" }]} onChange={(value) => patch("pageSize", value)} />
      <ToggleField label="Exclude my prompts" hint="Export only ChatGPT responses." checked={preferences.excludeUserMessages} onChange={setExcludeUserMessages} />
      <button type="button" className="advanced-toggle" aria-expanded={advanced} onClick={onToggleAdvanced}>More options <span aria-hidden="true">{advanced ? "−" : "+"}</span></button>
      {advanced && (
        <div className="advanced-panel">
          <SelectField label="Messages" value={preferences.messageFilter} options={[{ value: "all", label: "All messages" }, { value: "assistant", label: "Assistant only" }, { value: "user", label: "User only" }]} onChange={setMessageFilter} />
          <SelectField label="Margins" value={preferences.marginPreset} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "comfortable", label: "Comfortable" }]} onChange={(value) => patch("marginPreset", value)} />
          <SelectField label="Code theme" value={preferences.codeTheme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={(value) => patch("codeTheme", value)} />
          <ToggleField label="Include title" checked={preferences.includeTitle} onChange={(value) => patch("includeTitle", value)} />
          <ToggleField label="Include export date" checked={preferences.includeExportDate} onChange={(value) => patch("includeExportDate", value)} />
          <ToggleField label="Include source URL" hint="Off by default for privacy" checked={preferences.includeSourceUrl} onChange={(value) => patch("includeSourceUrl", value)} />
          <ToggleField label="Wrap long code lines" checked={preferences.wrapCode} onChange={(value) => patch("wrapCode", value)} />
          <ToggleField label="Show code language" checked={preferences.showCodeLanguage} onChange={(value) => patch("showCodeLanguage", value)} />
          <button type="button" className="reset-button" onClick={onReset}>Reset to defaults</button>
        </div>
      )}
    </section>
  );
}
