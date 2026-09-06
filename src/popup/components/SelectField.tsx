import type { ChangeEvent } from "react";

interface Props<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange(value: T): void;
  hint?: string;
}

export function SelectField<T extends string>({ label, value, options, onChange, hint }: Props<T>) {
  const handle = (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as T);
  return (
    <label className="setting-row">
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <select value={value} onChange={handle} aria-label={label}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
