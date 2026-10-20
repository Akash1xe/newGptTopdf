import { collectFullChatGPTConversation } from '../src/providers/chatgpt/chatgptCollector';
import { renderConversation } from '../src/renderer/conversationRenderer';
import { buildPrintStyles } from '../src/renderer/printStyles';
import { DEFAULT_EXPORT_PREFERENCES } from '../src/types/preferences';

// Deliberately not a real ChatGPT page: deterministic, isolated regression data.
const total = 120;
const paragraphs = 40;
const height = 700;
const virtual = new URLSearchParams(location.search).has('virtual');
document.body.innerHTML = '<div id="viewport" style="height:600px;width:850px;overflow:auto"><main style="position:relative"></main></div>';
const viewport = document.querySelector<HTMLElement>('#viewport')!;
const main = document.querySelector<HTMLElement>('main')!;
main.style.height = `${height * total}px`;
function makeTurn(index: number): HTMLElement {
  const node = document.createElement('article');
  node.dataset.messageAuthorRole = index % 2 ? 'assistant' : 'user';
  node.dataset.messageId = `message-${index}`;
  if (!virtual) node.dataset.testid = `conversation-turn-${index}`;
  node.style.cssText = `position:absolute;top:${index * height}px;height:${height}px;overflow:hidden;width:800px`;
  node.innerHTML = `<p>Excerpt for message ${index}</p>`;
  return node;
}
if (!virtual) for (let index = 0; index < total; index++) main.append(makeTurn(index));
function hydrate() {
  const first = Math.max(0, Math.floor(viewport.scrollTop / height) - 1);
  const last = Math.min(total - 1, Math.floor((viewport.scrollTop + 600) / height) + 1);
  if (virtual) main.replaceChildren();
  for (let index = first; index <= last; index++) {
    const node = virtual ? makeTurn(index) : main.children[index] as HTMLElement;
    node.innerHTML = Array.from({length: paragraphs}, (_, part) =>
      `<p>MARKER_${index}_${part} This paragraph must survive capture, ordering, rendering and PDF pagination. Missing middle and early sections are not acceptable.</p>`
    ).join('');
    if (virtual) main.append(node);
  }
}
let timer: ReturnType<typeof setTimeout>;
viewport.addEventListener('scroll', () => {
  clearTimeout(timer);
  timer = setTimeout(hydrate, 5);
});
viewport.scrollTop = height * Math.floor(total / 2);
hydrate();
const result = collectFullChatGPTConversation(document, location, {
  mutationWaitMs: 20, settleMs: 20, maxDurationMs: 120_000
}).then(conversation => {
  clearTimeout(timer);
  if (conversation.completeness.state !== 'complete') throw new Error(JSON.stringify(conversation.completeness));
  if (conversation.messages.length !== total) throw new Error(`Expected ${total} messages, got ${conversation.messages.length}`);
  conversation.messages.forEach((message, index) => {
    if (message.id !== `message-${index}`) throw new Error(`Wrong order at ${index}: ${message.id}`);
    for (let part = 0; part < paragraphs; part++) {
      if (!message.plainText.includes(`MARKER_${index}_${part} `)) throw new Error(`Missing ${index}:${part}`);
    }
  });
  const prefs = {...DEFAULT_EXPORT_PREFERENCES, bodyFontSize: 11};
  document.body.replaceChildren(renderConversation(document, conversation, prefs));
  const style = document.createElement('style');
  style.textContent = buildPrintStyles(prefs);
  document.head.append(style);
  return {messages: total, paragraphs: total * paragraphs, diagnostics: conversation.completeness};
});
(window as unknown as {collectionResult: typeof result}).collectionResult = result;
