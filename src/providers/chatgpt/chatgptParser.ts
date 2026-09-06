import { parseBlocks, blocksToPlainText } from "../../parser/blockParser";
import type { ParserContext } from "../../parser/types";
import { shouldIgnoreChatGPTElement } from "./chatgptDomUtils";
import { extractCodeBlock, isCodeBlockElement } from "./chatgptCode";
import { extractMathNode, isMathElement } from "./chatgptMath";
import { extractChatGPTImageBlock, isChatGPTImageElement } from "./chatgptMedia";

export const chatGPTParserContext: ParserContext = {
  shouldIgnoreElement: shouldIgnoreChatGPTElement,
  isCodeBlock: isCodeBlockElement,
  extractCodeBlock,
  isMathElement,
  extractMathNode,
  isImageElement: isChatGPTImageElement,
  extractImageBlock: extractChatGPTImageBlock
};

export function parseChatGPTMessage(content: Element) {
  const blocks = parseBlocks(content, chatGPTParserContext);
  return { blocks, plainText: blocksToPlainText(blocks) };
}
