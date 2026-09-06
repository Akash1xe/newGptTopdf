import type { ExtensionRequest, ExtensionResponse } from "../types/messages";

export function isChatGPTUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "chatgpt.com" || parsed.hostname.endsWith(".chatgpt.com");
  } catch {
    return false;
  }
}

export function sendToTab(tabId: number, request: ExtensionRequest): Promise<ExtensionResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, request, (response: ExtensionResponse | undefined) => {
      if (chrome.runtime.lastError || !response) {
        resolve({ success: false, error: "CONTENT_SCRIPT_UNAVAILABLE", message: "Reload the ChatGPT tab once, then open the extension again." });
        return;
      }
      resolve(response);
    });
  });
}
