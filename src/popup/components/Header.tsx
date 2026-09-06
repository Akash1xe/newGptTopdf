export function Header() {
  return (
    <header className="brand-row">
      <div className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M6.5 2.75h7L18.5 7.8v13.45H6.5z"/><path d="M13.5 2.75V8h5"/><path d="M9 12h7M9 15h7M9 18h4"/></svg>
      </div>
      <div className="brand-copy">
        <h1>ChatGPT to PDF</h1>
        <p>Clean exports. Code and math preserved.</p>
      </div>
    </header>
  );
}
