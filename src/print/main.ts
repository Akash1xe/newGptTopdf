import { getPrintJob, removePrintJob } from "../services/printJobService";
import { buildPrintStyles } from "../renderer/printStyles";
import { renderConversation, safePdfTitle } from "../renderer/conversationRenderer";

function waitForImages(document: Document, timeoutMs = 3500): Promise<void> {
  const pending = Array.from(document.images).filter((image) => !image.complete);
  if (!pending.length) return Promise.resolve();
  return new Promise((resolve) => {
    let remaining = pending.length;
    const done = () => { if (--remaining <= 0) resolve(); };
    pending.forEach((image) => {
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
    });
    setTimeout(resolve, timeoutMs);
  });
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#print-root");
  const status = document.querySelector<HTMLElement>("#print-status");
  const printButton = document.querySelector<HTMLButtonElement>("#print-button");
  const closeButton = document.querySelector<HTMLButtonElement>("#close-button");
  if (!root || !status || !printButton || !closeButton) return;

  const jobId = new URL(location.href).searchParams.get("job");
  if (!jobId) {
    status.textContent = "This print job is missing or expired.";
    printButton.disabled = true;
    return;
  }

  const job = await getPrintJob(jobId);
  if (!job) {
    status.textContent = "This print job is missing or expired. Export the conversation again.";
    printButton.disabled = true;
    return;
  }

  const style = document.createElement("style");
  style.textContent = buildPrintStyles(job.preferences);
  document.head.appendChild(style);
  document.title = safePdfTitle(job.conversation.title);
  root.replaceChildren(renderConversation(document, job.conversation, job.preferences));
  await removePrintJob(jobId);

  const doPrint = async () => {
    status.textContent = "Preparing print preview…";
    await waitForImages(document);
    status.textContent = "Print preview opened. Choose “Save as PDF” to finish.";
    window.print();
  };

  printButton.addEventListener("click", () => { void doPrint(); });
  closeButton.addEventListener("click", () => window.close());
  status.textContent = "Ready. Choose Print / Save as PDF.";
  setTimeout(() => { void doPrint(); }, 450);
}

void boot();
