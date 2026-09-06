import { useEffect, useState } from "react";
import type { ConversationData } from "../types/conversation";
import type { ExtensionEvent } from "../types/messages";
import type { ExportPreferences } from "../types/preferences";
import { DEFAULT_EXPORT_PREFERENCES } from "../types/preferences";
import { EXTENSION_VERSION } from "../constants/version";
import { getExportPreferences, resetExportPreferences, saveExportPreferences } from "../services/settingsService";
import { exportConversationToPdf } from "../services/pdfExportService";
import { isChatGPTUrl, sendToTab } from "./chrome";
import { Header } from "./components/Header";
import { PageStatus } from "./components/PageStatus";
import { ConversationSummary } from "./components/ConversationSummary";
import { ExportSettings } from "./components/ExportSettings";
import { ExportButton, type ExportStage } from "./components/ExportButton";

type PageState = "loading" | "unsupported" | "ready" | "empty" | "unavailable" | "error";

function progressMessage(event: ExtensionEvent): string {
  const { phase, messageCount, topStabilityPasses } = event.data;
  if (phase === "capturing") return `Loading full conversation… ${messageCount} messages collected.`;
  if (phase === "loading-older") return `Loading older messages… ${messageCount} messages collected.`;
  if (phase === "verifying-start") {
    const pass = topStabilityPasses > 0 ? ` Stability check ${topStabilityPasses}/3.` : "";
    return `Verifying the beginning of the conversation… ${messageCount} messages collected.${pass}`;
  }
  return `Restoring your chat position… ${messageCount} messages collected.`;
}

export function Popup() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [tabId, setTabId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [statusMessage, setStatusMessage] = useState("Checking the current page…");
  const [exportStage, setExportStage] = useState<ExportStage>("idle");
  const [preferences, setPreferences] = useState<ExportPreferences>(DEFAULT_EXPORT_PREFERENCES);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    void getExportPreferences().then(setPreferences).catch(() => setPreferences(DEFAULT_EXPORT_PREFERENCES));
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !isChatGPTUrl(tab.url)) {
        setPageState("unsupported");
        setStatusMessage("This extension currently works on chatgpt.com.");
        return;
      }
      setTabId(tab.id);
      const ping = await sendToTab(tab.id, { type: "PING" });
      if (!ping.success) {
        setPageState("unavailable");
        setStatusMessage(ping.message);
        return;
      }
      const response = await sendToTab(tab.id, { type: "EXTRACT_CONVERSATION", mode: "mounted" });
      if (response.success && response.type === "CONVERSATION") {
        setConversation(response.data);
        setPageState("ready");
        setStatusMessage("Ready to export. Full conversation history will be verified before PDF generation.");
      } else if (!response.success && response.error === "NO_CONVERSATION_FOUND") {
        setPageState("empty");
        setStatusMessage("Start a ChatGPT conversation, then reopen the extension.");
      } else if (!response.success) {
        setPageState("error");
        setStatusMessage(response.message);
      }
    });
  }, []);

  useEffect(() => {
    const listener = (message: ExtensionEvent, sender: { tab?: { id?: number } }) => {
      if (message?.type !== "EXTRACTION_PROGRESS") return;
      if (tabId == null || sender.tab?.id !== tabId || exportStage !== "collecting") return;
      setStatusMessage(progressMessage(message));
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId, exportStage]);

  const updatePreferences = (next: ExportPreferences) => {
    setPreferences(next);
    void saveExportPreferences(next);
  };

  const resetPreferences = async () => {
    try { setPreferences(await resetExportPreferences()); } catch { setPreferences(DEFAULT_EXPORT_PREFERENCES); }
  };

  const cancelExtraction = async () => {
    if (exportStage === "failed") {
      setExportStage("idle");
      setStatusMessage("Ready to export. Full conversation history will be verified before PDF generation.");
      return;
    }
    if (tabId == null || exportStage !== "collecting") return;
    setStatusMessage("Cancelling full conversation loading…");
    await sendToTab(tabId, { type: "CANCEL_EXTRACTION" });
  };

  const exportPdf = async () => {
    if (tabId == null) return;
    setExportStage("collecting");
    setStatusMessage("Loading full conversation…");
    try {
      const response = await sendToTab(tabId, { type: "EXTRACT_CONVERSATION", mode: "full" });
      if (!response.success) {
        if (response.error === "EXTRACTION_CANCELLED") {
          setExportStage("idle");
          setStatusMessage("Full conversation loading was cancelled.");
          return;
        }
        if (response.error === "CONVERSATION_STILL_GENERATING") {
          setExportStage("idle");
          setStatusMessage(response.message);
          return;
        }
        if (response.error === "PAGE_CHANGED" || response.error === "SCROLL_CONTAINER_LOST") {
          setExportStage("failed");
          setStatusMessage(`${response.message} Retry full extraction after the conversation is stable.`);
          return;
        }
        setExportStage("failed");
        setStatusMessage(response.message);
        return;
      }
      if (response.type !== "CONVERSATION") {
        setExportStage("failed");
        setStatusMessage("The full conversation could not be verified. Retry the extraction.");
        return;
      }

      const data = response.data;
      setConversation(data);
      if (data.completeness.state !== "complete" || data.completeness.verifiedBeginning !== true) {
        setExportStage("failed");
        const reason = data.completeness.reason ? ` Reason: ${data.completeness.reason.replaceAll("-", " ")}.` : "";
        setStatusMessage(`Could not verify the full conversation. ${data.messageCount} messages were collected, but the beginning of the chat could not be confirmed.${reason}`);
        return;
      }

      setExportStage("preparing");
      setStatusMessage(`Full conversation loaded. ${data.messageCount} messages collected. Preparing PDF…`);
      await exportConversationToPdf(data, preferences);
      setExportStage("idle");
      setStatusMessage("Print page opened. Choose “Save as PDF” in Chrome’s print preview.");
    } catch {
      setExportStage("failed");
      setStatusMessage("The PDF export could not be prepared. Retry full extraction.");
    }
  };

  const status = (() => {
    if (pageState === "loading") return { tone: "loading" as const, title: "Checking page" };
    if (pageState === "ready" && exportStage === "failed") return { tone: "warning" as const, title: "Full conversation not verified" };
    if (pageState === "ready" && exportStage === "collecting") return { tone: "loading" as const, title: "Loading full conversation" };
    if (pageState === "ready" && exportStage === "preparing") return { tone: "loading" as const, title: "Preparing PDF" };
    if (pageState === "ready") return { tone: "success" as const, title: "Conversation detected" };
    if (pageState === "empty") return { tone: "neutral" as const, title: "No conversation yet" };
    if (pageState === "unsupported") return { tone: "neutral" as const, title: "Open a ChatGPT conversation" };
    return { tone: "error" as const, title: pageState === "unavailable" ? "Reload ChatGPT" : "Unable to export" };
  })();

  const ready = pageState === "ready" && Boolean(conversation);

  return (
    <main className="popup-shell">
      <Header />
      <PageStatus tone={status.tone} title={status.title} message={statusMessage} />
      {conversation && <ConversationSummary conversation={conversation} />}
      {ready && (
        <>
          <ExportSettings preferences={preferences} onChange={updatePreferences} advanced={advanced} onToggleAdvanced={() => setAdvanced((value) => !value)} onReset={() => void resetPreferences()} />
          <ExportButton disabled={!ready} stage={exportStage} onExport={() => void exportPdf()} onCancel={() => void cancelExtraction()} />
        </>
      )}
      <div className="privacy-note"><span aria-hidden="true">⌁</span> Your conversation stays in your browser.</div>
      <footer><span>Local processing</span><span>v{EXTENSION_VERSION}</span></footer>
    </main>
  );
}
