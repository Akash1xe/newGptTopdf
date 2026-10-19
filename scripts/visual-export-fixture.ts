import { parseChatGPTMessage } from '../src/providers/chatgpt/chatgptParser';
import { renderBlocks } from '../src/renderer/blockRenderer';
import { buildPrintStyles } from '../src/renderer/printStyles';
import { DEFAULT_EXPORT_PREFERENCES } from '../src/types/preferences';

document.body.innerHTML = `<div id="source" style="width:720px;color:rgb(240,240,240);background:#000">
<h2>Architecture and color regression</h2>
<section style="border:1px solid #444;padding:20px;text-align:center">
<div><h3>Frontend</h3><p>React · User interface</p></div>
<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" style="color:#fff"><path d="M12 3v18m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
<div style="background:oklch(20% .04 250);border-radius:12px;padding:16px;text-align:center"><h3>Backend API</h3><p>Node.js · Express · Authentication</p></div>
<div style="background:rgb(0,40,28);border-radius:12px;padding:16px;text-align:center"><h3>Database</h3><p>MongoDB · Tasks and users</p></div></section>
<h2>Sliders and roadmap</h2><section style="border:1px solid #444;padding:12px">
<p>Study hours per day — 3 hours</p><span role="slider" aria-valuemin="1" aria-valuemax="8" aria-valuenow="3" aria-label="Hours"></span>
<p>Available days — 14 days</p><input type="range" min="7" max="30" value="14">
<h3>Backend launch roadmap</h3>
${[100,75,35,0].map((n,i)=>`<p>Week ${i+1}</p><span role="progressbar" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="100"></span>`).join('')}
</section>
<h2>Text accents and actions</h2><p style="color:oklch(80% .18 145)">Green success accent</p><p style="color:rgb(20,20,20)">Previously unreadable dark text</p>
<div style="background:#333;height:20px"></div>
<label><input type="radio" checked name="quiz">Redis stays beside its radio</label>
<div style="background:#333;padding:30px"><div>JavaScript</div><pre><code>const refined = true;</code></pre></div>
<svg width="300" height="90" viewBox="0 0 300 90"><g class="node"><rect x="5" y="5" width="290" height="80" rx="10" style="fill:rgb(0,45,20)"/><text x="150" y="50" text-anchor="middle" style="fill:rgb(180,240,200)">Readable diagram label</text></g></svg>
<button>Open PDF</button><button>Copy</button>
<div style="display:flex;gap:16px"><svg width="20" height="20" aria-hidden="true" viewBox="0 0 24 24" style="color:rgb(0,240,120)"><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"/><path stroke="currentColor" d="m6 12 4 4 8-8" fill="none"/></svg><div><h3>Step 1: Read the server logs</h3><p>Find the exception and its stack trace.</p></div></div>
</div>`;
const blocks = parseChatGPTMessage(document.querySelector('#source')!).blocks;
const theme = new URLSearchParams(location.search).get('theme') === 'light' ? 'light' : 'dark';
const prefs = { ...DEFAULT_EXPORT_PREFERENCES, pdfTheme: theme, bodyFontSize:11 } as const;
const article = document.createElement('article');
article.className = `export-document theme-${theme}`;
article.append(renderBlocks(document, blocks, prefs));
document.body.replaceChildren(article);
const style = document.createElement('style'); style.textContent = buildPrintStyles(prefs); document.head.append(style);
(window as unknown as {fixtureReady:boolean}).fixtureReady = true;
