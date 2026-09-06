import type { ConversationProvider } from "../types";
import { extractChatGPTConversation } from "./chatgptExtractor";
import { collectFullChatGPTConversation } from "./chatgptCollector";

export const chatGPTProvider: ConversationProvider = {
  id: "chatgpt",
  isSupportedLocation(location) {
    return location.hostname === "chatgpt.com" || location.hostname.endsWith(".chatgpt.com");
  },
  extract(document, location) {
    return extractChatGPTConversation(document, location);
  },
  extractFull(document, location, onProgress) {
    return collectFullChatGPTConversation(document, location, { onProgress });
  }
};
