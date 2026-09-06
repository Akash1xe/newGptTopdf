export type ExportStage = "idle" | "collecting" | "preparing" | "failed";

interface Props {
  disabled: boolean;
  stage: ExportStage;
  onExport(): void;
  onCancel(): void;
}

export function ExportButton({ disabled, stage, onExport, onCancel }: Props) {
  const collecting = stage === "collecting";
  const preparing = stage === "preparing";
  const failed = stage === "failed";
  const label = collecting
    ? "Loading full conversation…"
    : preparing
      ? "Preparing PDF…"
      : failed
        ? "Retry full extraction"
        : "Export PDF";

  return (
    <div className="export-actions">
      <button className="primary-button" type="button" disabled={disabled || collecting || preparing} onClick={onExport}>{label}</button>
      {(collecting || failed) && (
        <button className="secondary-button" type="button" onClick={onCancel}>{collecting ? "Cancel loading" : "Cancel"}</button>
      )}
    </div>
  );
}
