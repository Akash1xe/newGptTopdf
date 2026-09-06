interface Props {
  disabled: boolean;
  busy: boolean;
  partialConfirm: boolean;
  onClick(): void;
}

export function ExportButton({ disabled, busy, partialConfirm, onClick }: Props) {
  return <button className="primary-button" type="button" disabled={disabled || busy} onClick={onClick}>{busy ? "Preparing PDF…" : partialConfirm ? "Export PDF anyway" : "Export PDF"}</button>;
}
