import type { CodeBlock, ImageBlock, MathNode } from "../types/content";

export interface ParserContext {
  shouldIgnoreElement(element: Element): boolean;
  isCodeBlock(element: Element): boolean;
  extractCodeBlock(element: Element): CodeBlock | null;
  isMathElement(element: Element): boolean;
  extractMathNode(element: Element): MathNode | null;
  isImageElement?(element: Element): boolean;
  extractImageBlock?(element: Element): ImageBlock | null;
}
