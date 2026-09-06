import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
  unit?: string;
  step?: number;
  compact?: boolean;
}

export function NumberField({ label, value, min, max, onChange, unit, step = 1, compact = false }: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <label className={compact ? "number-field number-field-compact" : "number-field"}>
      <span>{label}</span>
      <span className="number-input-wrap">
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          aria-label={label}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
        {unit && <small>{unit}</small>}
      </span>
    </label>
  );
}
