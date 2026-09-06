import { useEffect, useState } from "react";
import type { ConversationData } from "../types/conversation";
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
import { ExportButton } from "./components/ExportButton";

 type PageState = "loading" | "unsupported" | "ready" | "empty" | "unavailable" | "error";

export function Popup() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [tabId, setTabId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [statusMessage, setStatusMessage] = useState("Checking the current page…");
  const [busy, setBusy] = useState(false);
  const [preferences, setPreferences] = useState<ExportPreferences>(DEFAULT_EXPORT_PREFERENCES);
  const [advanced, setAdvanced] = useState(false);
  const [partialConfirm, setPartialConfirm] = useState(false);

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
        setStatusMessage(response.data.possiblyPartial ? "Conversation detected. Full history will be collected before export." : "Ready to export.");
      } else if (!response.success && response.error === "NO_CONVERSATION_FOUND") {
        setPageState("empty");
        setStatusMessage("Start a ChatGPT conversation, then reopen the extension.");
      } else if (!response.success) {
        setPageState("error");
        setStatusMessage(response.message);
      }
    });
  }, []);

  const updatePreferences = (next: ExportPreferences) => {
    setPreferences(next);
    void saveExportPreferences(next);
  };

  const resetPreferences = async () => {
    try { setPreferences(await resetExportPreferences()); } catch { setPreferences(DEFAULT_EXPORT_PREFERENCES); }
  };

  const exportPdf = async () => {
    if (tabId == null) return;
    setBusy(true);
    setStatusMessage("Collecting the full conversation…");
    try {
      let data = conversation;
      if (!partialConfirm) {
        const response = await sendToTab(tabId, { type: "EXTRACT_CONVERSATION", mode: "full" });
        if (!response.success) {
          setPageState(response.error === "CONVERSATION_STILL_GENERATING" ? "error" : pageState);
          setStatusMessage(response.message);
          return;
        }
        if (response.type !== "CONVERSATION") return;
        data = response.data;
        setConversation(data);
        if (data.completeness.state !== "complete") {
          setPartialConfirm(true);
          setStatusMessage("Some older messages may not have loaded. Review this warning, then export anyway if you want the collected content.");
          return;
        }
      }
      if (!data) return;
      setStatusMessage("Preparing the print document…");
      await exportConversationToPdf(data, preferences);
      setPartialConfirm(false);
      setStatusMessage("Print page opened. Choose “Save as PDF” in Chrome’s print preview.");
    } catch {
      setStatusMessage("The PDF export could not be prepared. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const status = (() => {
    if (pageState === "loading") return { tone: "loading" as const, title: "Checking page" };
    if (pageState === "ready" && partialConfirm) return { tone: "warning" as const, title: "Partial conversation warning" };
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
          <ExportButton disabled={!ready} busy={busy} partialConfirm={partialConfirm} onClick={() => void exportPdf()} />
        </>
      )}
      <div className="privacy-note"><span aria-hidden="true">⌁</span> Your conversation stays in your browser.</div>
      <footer><span>Local processing</span><span>v{EXTENSION_VERSION}</span></footer>
    </main>
  );
}
