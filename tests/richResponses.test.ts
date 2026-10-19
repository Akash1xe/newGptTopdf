import { beforeEach, describe, expect, it } from 'vitest';
import { extractChatGPTConversation } from '../src/providers/chatgpt/chatgptExtractor';
import { parseChatGPTMessage } from '../src/providers/chatgpt/chatgptParser';
import { renderConversation } from '../src/renderer/conversationRenderer';
import { DEFAULT_EXPORT_PREFERENCES } from '../src/types/preferences';
import { renderImage } from '../src/renderer/imageRenderer';
import { renderBlocks } from '../src/renderer/blockRenderer';

beforeEach(() => { document.body.innerHTML = ''; });
describe('rich response compatibility', () => {
  it('removes empty decorative panels but retains zero-valued progress', () => {
    document.body.innerHTML = '<div id="root"><div style="background:#333;height:20px"></div><span role="progressbar" aria-valuenow="0"></span></div>';
    const result = parseChatGPTMessage(document.querySelector('#root')!);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({type:'control',kind:'progress',percent:0});
  });
  it('keeps choice labels on the control row without duplicating them', () => {
    document.body.innerHTML = '<div id="root"><label><input type="radio" checked><span>Redis</span></label></div>';
    const result = parseChatGPTMessage(document.querySelector('#root')!);
    expect(result.blocks).toEqual([{type:'control',kind:'radio',text:'[x] Redis',checked:true,percent:0}]);
  });
  it('compacts code-only shells but preserves surrounding prose', () => {
    document.body.innerHTML = '<div id="root"><div style="background:#333"><div>JavaScript</div><pre><code>one()</code></pre></div><div><p>Explanation</p><pre><code>two()</code></pre></div></div>';
    const result = parseChatGPTMessage(document.querySelector('#root')!);
    expect(result.blocks[0].type).toBe('code');
    expect(result.plainText).toContain('Explanation');
  });
  it('keeps external link text inline and preserves its destination', () => {
    document.body.innerHTML = '<div id="root"><a href="https://example.com/docs">Documentation<svg width="16" height="16" viewBox="0 0 24 24"><path d="M0 0L10 10"/></svg></a></div>';
    const result = parseChatGPTMessage(document.querySelector('#root')!);
    expect(result.blocks).toHaveLength(1);
    expect(JSON.stringify(result.blocks)).toContain('https://example.com/docs');
  });
  it('preserves card grids and renders selected radios and slider positions', () => {
    document.body.innerHTML = `<div id="content"><div style="display:grid;grid-template-columns:1fr 1fr"><div style="border:1px solid gray"><p>Total tasks</p><h3>128</h3></div><div style="border:1px solid gray"><p>Completed</p><h3>96</h3></div></div><input type="range" min="1" max="8" value="3"><button role="radio" aria-checked="true">Redis</button></div>`;
    const result = parseChatGPTMessage(document.querySelector('#content')!);
    const output = document.createElement('div');
    output.append(renderBlocks(document, result.blocks, DEFAULT_EXPORT_PREFERENCES));
    expect(output.querySelectorAll('.visual-card')).toHaveLength(2);
    expect(output.querySelector('.visual-layout')!.children).toHaveLength(2);
    expect(output.querySelector('.visual-radio.is-checked')).not.toBeNull();
    expect(output.querySelector<HTMLElement>('.visual-slider')!.style.getPropertyValue('--position')).toMatch(/^28\.57/);
    expect(output.textContent).toContain('Redis');
    expect(result.plainText).toContain('128');
  });
  it('snapshots current form values, selections and ranges without exporting secrets', () => {
    document.body.innerHTML = `<div id="content"><input name="Title" value="Old"><input type="date" value="2026-10-20"><input type="range" value="42"><input type="password" value="SECRET"><textarea>Old feedback</textarea><select><option>Low</option><option selected>High</option></select><div role="slider" aria-valuenow="3" aria-label="Hours"></div></div>`;
    document.querySelector('input')!.value = 'Updated title';
    document.querySelector('textarea')!.value = 'Updated feedback';
    const result = parseChatGPTMessage(document.querySelector('#content')!);
    expect(result.plainText).toContain('Updated title');
    expect(result.plainText).toContain('Updated feedback');
    expect(result.plainText).toContain('2026-10-20');
    expect(result.plainText).toContain('42');
    expect(result.plainText).toContain('High');
    expect(result.plainText).not.toContain('Low');
    expect(result.plainText).not.toContain('SECRET');
    expect(result.plainText).toContain('Hours: 3');
  });
  it('preserves standalone language blocks and structural code line breaks', () => {
    document.body.innerHTML = `<div id="content"><code class="language-csv">id,title\n1,First\n2,Second</code><pre><code><div>one</div><div>  two</div><div>three<br>four</div></code></pre><p>Literal <code>hello</code></p></div>`;
    const result = parseChatGPTMessage(document.querySelector('#content')!);
    const blocks = result.blocks.filter(b => b.type === 'code');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].code).toBe('id,title\n1,First\n2,Second');
    expect(blocks[1].code).toBe('one\n  two\nthree\nfour');
    expect(result.plainText).toContain('Literal hello');
  });
  it('keeps thumbnail display width in exported images', () => {
    document.body.innerHTML = `<div><img src="https://example.com/logo.png" width="70" height="70" alt="Node.js"></div>`;
    const result = parseChatGPTMessage(document.body.firstElementChild!);
    const block = result.blocks.find(b => b.type === 'image')!;
    expect(block.width).toBe(70);
    expect(renderImage(document, block).querySelector('img')!.style.width).toBe('70px');
  });
  it('captures classless sibling response content beyond an inner label shell', () => {
    document.body.innerHTML = `<article data-testid="conversation-turn-1"><div data-message-id="a1"><h5 data-conversation-role="assistant">ChatGPT said:</h5></div><div><p>First answer</p><div>Total tasks: 128</div><p>Last answer</p></div></article>`;
    const result = extractChatGPTConversation(document, window.location);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].plainText).toContain('First answer');
    expect(result.messages[0].plainText).toContain('Last answer');
    expect(result.messages[0].plainText).not.toContain('ChatGPT said:');
  });
  it('keeps multiple markdown blocks and interleaved cards without mixing user prompts', () => {
    document.body.innerHTML = `<div data-turn-key="g"><div data-user-message-bubble>PRIVATE PROMPT</div><h5 data-conversation-role="assistant">ChatGPT said:</h5><div class="markdown"><p>Introduction</p></div><div><h3>Total tasks</h3><p>128</p></div><div class="markdown"><p>Conclusion</p></div><button>Copy</button></div>`;
    const data = extractChatGPTConversation(document, window.location);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[1].plainText).toContain('Introduction');
    expect(data.messages[1].plainText).toContain('128');
    expect(data.messages[1].plainText).toContain('Conclusion');
    expect(data.messages[1].plainText).not.toMatch(/PRIVATE PROMPT|Copy/);
    const rendered = renderConversation(document, data, DEFAULT_EXPORT_PREFERENCES);
    expect(rendered.querySelector('.message-assistant')?.textContent).toContain('Conclusion');
  });
  it('keeps content across sibling markdown nodes inside the role container', () => {
    document.body.innerHTML = `<article data-turn-id="a"><div data-message-author-role="assistant"><div class="markdown">First</div><div>Dashboard 96 completed</div><div class="markdown">Final</div></div></article>`;
    const text = extractChatGPTConversation(document, window.location).messages[0].plainText;
    expect(text).toContain('First'); expect(text).toContain('Dashboard 96 completed'); expect(text).toContain('Final');
  });
  it('captures native and ARIA checked states without changing controls', () => {
    document.body.innerHTML = `<div id="content"><label><input type="checkbox" checked>Design schema</label><button role="checkbox" aria-checked="false">Build API</button><button role="radio" aria-checked="true">PostgreSQL</button><p>Recommendation: PostgreSQL</p><button>Reset checklist</button></div>`;
    const root = document.querySelector('#content')!;
    const text = parseChatGPTMessage(root).plainText;
    expect(text).toContain('[x]'); expect(text).toContain('Design schema');
    expect(text).toContain('[ ] Build API'); expect(text).toContain('[x] PostgreSQL');
    expect(text).not.toContain('Reset checklist');
    expect(root.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
  });
  it('keeps linked image cards, citations, and SVG labels', () => {
    document.body.innerHTML = `<div id="content"><button><img src="https://example.com/card.png" width="400" height="200" alt="Task dashboard"></button><p><a href="https://example.com/docs">Documentation</a></p><svg viewBox="0 0 300 200" aria-label="Workflow"><text>User submits task</text><path d="M0 0L10 10"/></svg></div>`;
    const result = parseChatGPTMessage(document.querySelector('#content')!);
    expect(result.blocks.filter(b => b.type === 'image')).toHaveLength(2);
    expect(result.plainText).toContain('User submits task');
    expect(JSON.stringify(result.blocks)).toContain('https://example.com/docs');
  });
  it('preserves images nested in paragraphs and marks inaccessible embeds', () => {
    document.body.innerHTML = `<div id="content"><p>Before <a><img src="https://example.com/a.png" alt="Figure"></a> After</p><iframe title="Interactive graph"></iframe></div>`;
    const result = parseChatGPTMessage(document.querySelector('#content')!);
    expect(result.blocks.some(b => b.type === 'image')).toBe(true);
    expect(result.plainText).toContain('Before'); expect(result.plainText).toContain('After');
    expect(result.plainText).toContain('Embedded content: Interactive graph');
  });
});
