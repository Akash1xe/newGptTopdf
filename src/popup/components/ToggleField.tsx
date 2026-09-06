import type { ChangeEvent } from "react";
interface Props {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
  hint?: string;
}

export function ToggleField({ label, checked, onChange, hint }: Props) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)} />
    </label>
  );
}
