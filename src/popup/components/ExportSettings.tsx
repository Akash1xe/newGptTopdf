import type { ExportPreferences, MessageFilter } from "../../types/preferences";
import { NumberField } from "./NumberField";
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

  const setCustomMargin = (side: keyof ExportPreferences["customMargins"], value: number) => {
    onChange({
      ...preferences,
      customMargins: { ...preferences.customMargins, [side]: value }
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
          <div className="settings-subsection">
            <div className="settings-subheading">Layout</div>
            <SelectField label="Margins" value={preferences.marginPreset} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }, { value: "custom", label: "Custom" }]} onChange={(value) => patch("marginPreset", value)} />
            {preferences.marginPreset === "custom" && (
              <div className="margin-grid" aria-label="Custom page margins">
                <NumberField compact label="Top" value={preferences.customMargins.top} min={5} max={40} unit="mm" onChange={(value) => setCustomMargin("top", value)} />
                <NumberField compact label="Right" value={preferences.customMargins.right} min={5} max={40} unit="mm" onChange={(value) => setCustomMargin("right", value)} />
                <NumberField compact label="Bottom" value={preferences.customMargins.bottom} min={5} max={40} unit="mm" onChange={(value) => setCustomMargin("bottom", value)} />
                <NumberField compact label="Left" value={preferences.customMargins.left} min={5} max={40} unit="mm" onChange={(value) => setCustomMargin("left", value)} />
              </div>
            )}
            <SelectField label="Message padding" value={preferences.messagePadding} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "spacious", label: "Spacious" }]} onChange={(value) => patch("messagePadding", value)} />
            <SelectField label="Message spacing" value={preferences.messageSpacing} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "spacious", label: "Spacious" }]} onChange={(value) => patch("messageSpacing", value)} />
            <SelectField label="Paragraph spacing" value={preferences.paragraphSpacing} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "spacious", label: "Spacious" }]} onChange={(value) => patch("paragraphSpacing", value)} />
            <SelectField label="Line spacing" value={preferences.lineSpacing} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "relaxed", label: "Relaxed" }]} onChange={(value) => patch("lineSpacing", value)} />
          </div>

          <div className="settings-subsection">
            <div className="settings-subheading">Typography</div>
            <SelectField label="Font" value={preferences.bodyFontFamily} options={[{ value: "system", label: "System" }, { value: "arial", label: "Arial" }, { value: "georgia", label: "Georgia" }, { value: "times", label: "Times New Roman" }, { value: "verdana", label: "Verdana" }, { value: "tahoma", label: "Tahoma" }, { value: "trebuchet", label: "Trebuchet MS" }]} onChange={(value) => patch("bodyFontFamily", value)} />
            <NumberField label="Font size" value={preferences.bodyFontSize} min={9} max={18} unit="pt" onChange={(value) => patch("bodyFontSize", value)} />
            <SelectField label="Text thickness" hint="Controls normal PDF text weight." value={preferences.textWeight} options={[{ value: "light", label: "Light" }, { value: "regular", label: "Regular" }, { value: "medium", label: "Medium" }, { value: "semibold", label: "Semi-bold" }]} onChange={(value) => patch("textWeight", value)} />
            <NumberField label="Code font size" value={preferences.codeFontSize} min={8} max={16} unit="pt" onChange={(value) => patch("codeFontSize", value)} />
          </div>

          <div className="settings-subsection">
            <div className="settings-subheading">Content</div>
            <SelectField label="Messages" value={preferences.messageFilter} options={[{ value: "all", label: "All messages" }, { value: "assistant", label: "Assistant only" }, { value: "user", label: "User only" }]} onChange={setMessageFilter} />
            <ToggleField label="Include title" checked={preferences.includeTitle} onChange={(value) => patch("includeTitle", value)} />
            <ToggleField label="Include export date" checked={preferences.includeExportDate} onChange={(value) => patch("includeExportDate", value)} />
            <ToggleField label="Include source URL" hint="Off by default for privacy" checked={preferences.includeSourceUrl} onChange={(value) => patch("includeSourceUrl", value)} />
          </div>

          <div className="settings-subsection">
            <div className="settings-subheading">Code</div>
            <SelectField label="Code theme" value={preferences.codeTheme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={(value) => patch("codeTheme", value)} />
            <ToggleField label="Wrap long code lines" checked={preferences.wrapCode} onChange={(value) => patch("wrapCode", value)} />
            <ToggleField label="Show code language" checked={preferences.showCodeLanguage} onChange={(value) => patch("showCodeLanguage", value)} />
          </div>

          <button type="button" className="reset-button" onClick={onReset}>Reset to defaults</button>
        </div>
      )}
    </section>
  );
}
