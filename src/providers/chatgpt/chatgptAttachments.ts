import { getMessageRole } from "./chatgptDomUtils";

/** Match file-card UI, not filenames mentioned in ordinary prose or code. */
export function findUserFileCards(content: Element, role?: "user" | "assistant"): Set<Element> {
  const cards = new Set<Element>();
  const assistantMarker = [...content.querySelectorAll("*")].find(node => getMessageRole(node) === "assistant");
  const belongsToUser = (card: Element): boolean => {
    for (let node: Element | null = card; node; node = node.parentElement) {
      const owner = getMessageRole(node);
      if (owner) return owner === "user";
      if (node === content) break;
    }
    if (role === "user") return true;
    // A grouped turn can put uploads before the user bubble and assistant label.
    return !!assistantMarker
      && Boolean(assistantMarker.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_PRECEDING);
  };

  for (const leaf of content.querySelectorAll("div,span,a")) {
    if (leaf.children.length || leaf.closest("pre,code,svg")) continue;
    const filename = leaf.textContent?.trim() ?? "";
    if (filename.length > 240 || !/^.+\.[a-z0-9]{1,12}$/i.test(filename)) continue;
    for (let card = leaf.parentElement; card; card = card.parentElement) {
      const text = card.textContent?.trim() ?? "";
      const remainder = text.replace(filename, "").trim();
      const fileLabel = /^(?:PDF|DOCX?|XLSX?|PPTX?|CSV|TXT|RTF|ZIP|JSON|XML|MD|HTML|EPUB|WORD|DOCUMENT|SPREADSHEET|PRESENTATION|FILE)(?:\s*[·•-]?\s*\d+(?:\.\d+)?\s*[KMGT]?B)?$/i;
      if (card.querySelector("svg,img") && fileLabel.test(remainder) && belongsToUser(card)) {
        cards.add(card);
        break;
      }
      if (card === content || getMessageRole(card)) break;
    }
  }
  return cards;
}
