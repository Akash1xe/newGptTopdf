/** Snapshot current control state without clicking or changing the live page. */
export function controlText(element: Element): string | undefined {
  const role = element.getAttribute("role");
  const input = element.tagName === "INPUT" ? element as HTMLInputElement : undefined;
  const type = input?.type ?? role;
  const name = element.getAttribute("aria-label") || element.getAttribute("name") || "";
  if (input && !["checkbox", "radio"].includes(input.type)) {
    // Never copy secrets, hidden data, file paths, or action button values.
    if (["password", "hidden", "file", "submit", "reset", "button", "image"].includes(input.type)) return "";
    return `${name ? name + ': ' : ''}${input.value || '[empty]'}`;
  }
  if (element.tagName === "TEXTAREA") return `${name ? name + ': ' : ''}${(element as HTMLTextAreaElement).value || '[empty]'}`;
  if (element.tagName === "SELECT") return `${name ? name + ': ' : ''}${Array.from((element as HTMLSelectElement).selectedOptions).map(option => option.textContent).join(', ') || '[empty]'}`;
  if (role === "slider" || role === "spinbutton" || role === "progressbar") {
    return `${name ? name + ': ' : ''}${element.getAttribute('aria-valuetext') || element.getAttribute('aria-valuenow') || '[value unavailable]'}`;
  }
  if (!["checkbox", "radio", "switch"].includes(type ?? "")) return undefined;
  const state = input ? (input.indeterminate ? "mixed" : String(input.checked)) : element.getAttribute("aria-checked");
  const marker = state === "true" ? "[x]" : state === "mixed" ? "[-]" : "[ ]";
  const label = input ? element.getAttribute("aria-label") ?? "" : element.textContent?.trim() || element.getAttribute("aria-label") || "";
  return `${marker} ${label}`;
}
