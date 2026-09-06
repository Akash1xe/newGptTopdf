import type { ImageBlock } from "../types/content";
import { el } from "./dom";

export function renderImage(document: Document, block: ImageBlock): HTMLElement {
  const figure = el(document, "figure", "media-block");
  if (!block.src) {
    const placeholder = el(document, "div", "media-placeholder");
    placeholder.textContent = block.alt ? `[Image unavailable: ${block.alt}]` : "[Image could not be included]";
    figure.appendChild(placeholder);
    return figure;
  }
  const img = el(document, "img");
  img.src = block.src;
  img.alt = block.alt ?? "Conversation image";
  img.loading = "eager";
  img.decoding = "async";
  img.addEventListener("error", () => {
    const placeholder = el(document, "div", "media-placeholder");
    placeholder.textContent = block.alt ? `[Image unavailable: ${block.alt}]` : "[Image could not be included]";
    img.replaceWith(placeholder);
  }, { once: true });
  figure.appendChild(img);
  if (block.caption) {
    const caption = el(document, "figcaption");
    caption.textContent = block.caption;
    figure.appendChild(caption);
  }
  return figure;
}
