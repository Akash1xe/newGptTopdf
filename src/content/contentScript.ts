import type { ExtensionEvent, ExtensionRequest, ExtensionResponse, ExtractionDiagnostics } from "../types/messages";
import { chatGPTProvider } from "../providers/chatgpt/chatgptProvider";
import { ConversationCollectionError } from "../providers/chatgpt/chatgptCollector";
import { CHATGPT_SELECTORS } from "../providers/chatgpt/chatgptSelectors";
import { getRoleNodes } from "../providers/chatgpt/chatgptExtractor";
import { isConversationStreaming } from "../providers/chatgpt/chatgptDomUtils";
import { logger } from "../utils/logger";

logger.info("Content script loaded");

let activeCollectionController: AbortController | null = null;

function diagnostics(): ExtractionDiagnostics {
  return {
    roleNodeCount: document.querySelectorAll(CHATGPT_SELECTORS.roleNodes).length,
    turnShellCount: document.querySelectorAll(CHATGPT_SELECTORS.turnShells).length,
    activeRoleCount: getRoleNodes(document).length,
    mathSourceCount: document.querySelectorAll("[data-math-source], [data-latex], [data-tex], [data-math]").length,
    katexCount: document.querySelectorAll(".katex, .katex-display").length,
    texAnnotationCount: Array.from(document.querySelectorAll("annotation[encoding]")).filter((annotation) => /(?:tex|latex)/i.test(annotation.getAttribute("encoding") ?? "")).length,
    mathMlCount: document.querySelectorAll("math").length,
    streaming: isConversationStreaming(document),
    url: location.href
  };
}

function publishProgress(event: ExtensionEvent): void {
  try {
    chrome.runtime.sendMessage(event);
  } catch {
    // Popup may have closed. Full extraction still remains local and can finish safely.
  }
}

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse: (response: ExtensionResponse) => void) => {
  const handle = async () => {
    try {
      if (request.type === "PING") {
        sendResponse({ success: true, type: "PONG" });
        return;
      }
      if (request.type === "CHECK_CHATGPT_PAGE") {
        sendResponse({ success: true, type: "PAGE_STATUS", supported: chatGPTProvider.isSupportedLocation(location) });
        return;
      }
      if (request.type === "GET_EXTRACTION_DIAGNOSTICS") {
        sendResponse({ success: true, type: "DIAGNOSTICS", data: diagnostics() });
        return;
      }
      if (request.type === "CANCEL_EXTRACTION") {
        activeCollectionController?.abort();
        sendResponse({ success: true, type: "EXTRACTION_CANCELLED" });
        return;
      }
      if (request.type === "EXTRACT_CONVERSATION") {
        if (!chatGPTProvider.isSupportedLocation(location)) {
          sendResponse({ success: false, error: "UNSUPPORTED_PAGE", message: "Open a ChatGPT conversation to use this extension." });
          return;
        }
        if (isConversationStreaming(document)) {
          sendResponse({ success: false, error: "CONVERSATION_STILL_GENERATING", message: "Wait for ChatGPT to finish generating before exporting." });
          return;
        }

        if (request.mode === "full" && chatGPTProvider.extractFull) {
          activeCollectionController?.abort();
          const controller = new AbortController();
          activeCollectionController = controller;
          try {
            const data = await chatGPTProvider.extractFull(document, location, {
              signal: controller.signal,
              onProgress: (progress) => publishProgress({ type: "EXTRACTION_PROGRESS", data: progress })
            });
            if (data.messageCount === 0) {
              sendResponse({ success: false, error: "NO_CONVERSATION_FOUND", message: "No conversation messages were found on this page." });
              return;
            }
            logger.debug("Full conversation collected", { messages: data.messageCount, completeness: data.completeness.state });
            sendResponse({ success: true, type: "CONVERSATION", data });
          } finally {
            if (activeCollectionController === controller) activeCollectionController = null;
          }
          return;
        }

        const data = chatGPTProvider.extract(document, location);
        if (data.messageCount === 0) {
          sendResponse({ success: false, error: "NO_CONVERSATION_FOUND", message: "No conversation messages were found on this page." });
          return;
        }
        logger.debug("Conversation extracted", { messages: data.messageCount, completeness: data.completeness.state });
        sendResponse({ success: true, type: "CONVERSATION", data });
      }
    } catch (error) {
      if (error instanceof ConversationCollectionError) {
        sendResponse({ success: false, error: error.code, message: error.message });
        return;
      }
      logger.error("Extraction failed", error instanceof Error ? error.message : "Unknown extraction error");
      sendResponse({ success: false, error: "EXTRACTION_FAILED", message: "The conversation could not be extracted." });
    }
  };
  void handle();
  return true;
});
