interface Props {
  tone: "loading" | "success" | "warning" | "error" | "neutral";
  title: string;
  message: string;
}

export function PageStatus({ tone, title, message }: Props) {
  return (
    <section className={`status-card tone-${tone}`} aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      <div><strong>{title}</strong><p>{message}</p></div>
    </section>
  );
}
