import { parseBlocks, blocksToPlainText } from "../../parser/blockParser";
import type { ParserContext } from "../../parser/types";
import { shouldIgnoreChatGPTElement, getMessageRole } from "./chatgptDomUtils";
import { extractCodeBlock, isCodeBlockElement } from "./chatgptCode";
import { extractMathNode, isMathElement } from "./chatgptMath";
import { extractChatGPTImageBlock, isChatGPTImageElement } from "./chatgptMedia";
import { findUserFileCards } from "./chatgptAttachments";

export const chatGPTParserContext: ParserContext = {
  shouldIgnoreElement: shouldIgnoreChatGPTElement,
  isCodeBlock: isCodeBlockElement,
  extractCodeBlock,
  isMathElement,
  extractMathNode,
  isImageElement: isChatGPTImageElement,
  extractImageBlock: extractChatGPTImageBlock
};

export function parseChatGPTMessage(content: Element, role?: "user" | "assistant") {
  const fileCards = findUserFileCards(content, role);
  const context: ParserContext = {
    ...chatGPTParserContext,
    shouldIgnoreElement(element) {
      if (fileCards.has(element)) return true;
      const elementRole = getMessageRole(element);
      if (role && elementRole && elementRole !== role) return true;
      if ((elementRole || element.matches('h1,h2,h3,h4,h5,h6'))
        && /^(ChatGPT|Assistant|You)\s+said\s*:?$/i.test(element.textContent?.trim() ?? "")) return true;
      return shouldIgnoreChatGPTElement(element);
    }
  };
  const blocks = fileCards.has(content) ? [] : parseBlocks(content, context);
  return { blocks, plainText: blocksToPlainText(blocks), omittedAttachmentOnly: fileCards.size > 0 && blocks.length === 0 };
}
