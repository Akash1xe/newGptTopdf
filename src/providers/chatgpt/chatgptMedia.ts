import type { ImageBlock, ImageSourceType } from "../../types/content";

function sourceType(src: string | undefined): ImageSourceType {
  if (!src) return "unknown";
  if (src.startsWith("data:")) return "data";
  if (src.startsWith("blob:")) return "blob";
  if (/^https?:/i.test(src)) return "remote";
  return "unknown";
}

function meaningfulImage(img: HTMLImageElement): boolean {
  if (img.closest("button,[role=button],nav,aside")) return false;
  const width = img.naturalWidth || Number(img.getAttribute("width")) || img.clientWidth;
  const height = img.naturalHeight || Number(img.getAttribute("height")) || img.clientHeight;
  if (width > 0 && height > 0 && width <= 40 && height <= 40) return false;
  const alt = (img.getAttribute("alt") ?? "").toLowerCase();
  if (/avatar|logo|icon/.test(alt) && Math.max(width, height) <= 96) return false;
  return Boolean(img.currentSrc || img.src || alt);
}

function sanitizeSvg(svg: SVGElement): string {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.querySelectorAll("script,foreignObject,iframe,object,embed").forEach((node) => node.remove());
  for (const node of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if (["href", "xlink:href", "src"].includes(name) && /^(?:javascript:|https?:)/i.test(value)) node.removeAttribute(attr.name);
    }
  }
  return new XMLSerializer().serializeToString(clone);
}

function svgDataUrl(svg: SVGElement): string {
  const serialized = sanitizeSvg(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
}

export function isChatGPTImageElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "img") return meaningfulImage(element as HTMLImageElement);
  if (tag === "svg") return !element.closest("button,[role=button],nav,aside") && (element.clientWidth > 80 || element.clientHeight > 80 || Boolean(element.getAttribute("viewBox")));
  if (tag === "canvas") return !element.closest("button,[role=button],nav,aside") && ((element as HTMLCanvasElement).width > 80 || (element as HTMLCanvasElement).height > 80);
  return false;
}

export function extractChatGPTImageBlock(element: Element): ImageBlock | null {
  const tag = element.tagName.toLowerCase();
  if (tag === "img") {
    const img = element as HTMLImageElement;
    if (!meaningfulImage(img)) return null;
    const src = img.currentSrc || img.src || undefined;
    return {
      type: "image",
      src,
      alt: img.alt?.trim() || undefined,
      width: img.naturalWidth || img.clientWidth || undefined,
      height: img.naturalHeight || img.clientHeight || undefined,
      sourceType: sourceType(src),
      mediaKind: "image"
    };
  }
  if (tag === "svg") {
    const svg = element as SVGElement;
    try {
      const src = svgDataUrl(svg);
      return {
        type: "image",
        src,
        alt: svg.getAttribute("aria-label")?.trim() || "Diagram",
        width: svg.clientWidth || undefined,
        height: svg.clientHeight || undefined,
        sourceType: "data",
        mediaKind: "svg"
      };
    } catch {
      return { type: "image", alt: "Diagram", sourceType: "unknown", mediaKind: "svg" };
    }
  }
  if (tag === "canvas") {
    const canvas = element as HTMLCanvasElement;
    try {
      const src = canvas.toDataURL("image/png");
      return {
        type: "image",
        src,
        alt: canvas.getAttribute("aria-label")?.trim() || "Canvas diagram",
        width: canvas.width || undefined,
        height: canvas.height || undefined,
        sourceType: "data",
        mediaKind: "canvas"
      };
    } catch {
      return { type: "image", alt: "Canvas diagram", sourceType: "unknown", mediaKind: "canvas" };
    }
  }
  return null;
}
