import type { ImageBlock } from "../types/content";
import { el } from "./dom";
import { isSourceColor, readableSourceColor } from './sourceColors';

export function renderImage(document: Document, block: ImageBlock, theme: 'light' | 'dark' = 'light'): HTMLElement {
  const figure = el(document, "figure", "media-block");
  if (!block.src) {
    const placeholder = el(document, "div", "media-placeholder");
    placeholder.textContent = block.alt ? `[Image unavailable: ${block.alt}]` : "[Image could not be included]";
    figure.appendChild(placeholder);
    return figure;
  }
  const img = el(document, "img");
  img.src = block.src;
  if (theme === 'light' && block.mediaKind === 'svg' && block.src.startsWith('data:image/svg+xml;charset=utf-8,')) {
    try {
      const svg = new DOMParser().parseFromString(decodeURIComponent(block.src.split(',').slice(1).join(',')), 'image/svg+xml');
      const smallIcon = !!block.width && block.width <= 80;
      if (!smallIcon) {
        // Diagram labels are darkened below; their enclosing dark node boxes
        // must be lightened too. Keep chart paths/slices unchanged.
        svg.querySelectorAll('.node rect,rect.actor,rect.actor-box,.node polygon,.node ellipse,.node path').forEach(node => {
          const styled = node as SVGElement;
          const fill = styled.style.getPropertyValue('fill') || node.getAttribute('fill');
          if (isSourceColor(fill || undefined)) styled.style.setProperty('fill', `color-mix(in srgb, ${fill} 18%, white)`);
        });
      }
      svg.querySelectorAll(smallIcon ? '*' : 'text,tspan').forEach(node => {
        const styled = node as SVGElement;
        for (const property of ['fill', 'stroke', 'color']) {
          const color = styled.style?.getPropertyValue(property) || node.getAttribute(property);
          if (isSourceColor(color || undefined)) styled.style.setProperty(property, readableSourceColor(color!, document, 'rgb(255,255,255)'));
        }
      });
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    } catch { /* Preserve the original image if adaptation is unavailable. */ }
  }
  img.alt = block.alt ?? "Conversation image";
  img.loading = "eager";
  img.decoding = "async";
  // Preserve the displayed size of source-card thumbnails instead of using
  // the original high-resolution asset at full page width.
  if (block.width && Number.isFinite(block.width) && block.width > 0) img.style.width = `${block.width}px`;
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
