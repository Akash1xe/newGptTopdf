import { describe, it, expect } from 'vitest';
import { parseChatGPTMessage } from '../src/providers/chatgpt/chatgptParser';
import { renderBlocks } from '../src/renderer/blockRenderer';
import { buildPrintStyles } from '../src/renderer/printStyles';
import { DEFAULT_EXPORT_PREFERENCES as defaults } from '../src/types/preferences';
import { visualControl, layoutInfo } from '../src/parser/visualLayout';
import { isSourceColor } from '../src/renderer/sourceColors';

describe('dark PDF export', () => {
  it('accepts modern CSS colors but rejects injected declarations and urls', () => {
    expect(isSourceColor('oklch(80% .2 145)')).toBe(true);
    expect(isSourceColor('color(srgb 0.2 0.8 0.1)')).toBe(true);
    expect(isSourceColor('rgb(0,0,0); background:url(https://example.com)')).toBe(false);
  });
  it('keeps borderless colored panels and centered structure', () => {
    const panel = document.createElement('div'); panel.style.cssText = 'background:rgb(0,40,28);text-align:center';
    document.body.append(panel);
    expect(layoutInfo(panel)).toMatchObject({sourceBackground:'rgb(0, 40, 28)', sourceAlign:'center', darkOnly:true});
  });
  it('preserves span sliders nested in paragraphs as visual controls', () => {
    document.body.innerHTML = '<div id="root"><p><span><span role="slider" aria-valuemin="1" aria-valuemax="8" aria-valuenow="3"></span></span></p></div>';
    expect(parseChatGPTMessage(document.querySelector('#root')!).blocks[0]).toMatchObject({type:'control',kind:'slider'});
  });
  it('supports native, ARIA and CSS-only progress, including zero', () => {
    document.body.innerHTML = '<progress max="100" value="75"></progress><span role="progressbar" aria-valuenow="0"></span><div style="height:8px;background:#333"><div style="width:35%"></div></div>';
    expect(Array.from(document.body.children).map(el=>visualControl(el)?.percent)).toEqual([75,0,35]);
  });
  it('retains content icons and action labels without toolbar buttons', () => {
    document.body.innerHTML = '<div id="root"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path d="M0 0L10 10"/></svg><button>Open PDF</button><button>Copy</button></div>';
    const result = parseChatGPTMessage(document.querySelector('#root')!);
    expect(result.blocks.some(b=>b.type==='image' && b.width===20)).toBe(true);
    expect(result.plainText).toContain('Open PDF'); expect(result.plainText).not.toContain('Copy');
  });
  it('captures inherited and accent colors without changing the source page', () => {
    document.body.innerHTML = '<div id="answer" style="color:rgb(240,240,240)"><p>Normal <span style="color:rgb(0,200,100)">Success</span></p></div>';
    const root = document.querySelector('#answer')!;
    const before = root.outerHTML;
    const result = parseChatGPTMessage(root);
    expect(JSON.stringify(result.blocks)).toContain('rgb(0, 200, 100)');
    expect(JSON.stringify(result.blocks)).toContain('rgb(240, 240, 240)');
    expect(root.outerHTML).toBe(before);
  });
  it('adapts source card colors to light mode and leaves light code selection intact', () => {
    document.body.innerHTML = '<div id="answer"><div style="border:1px solid rgb(80,80,80);background:rgb(8,20,30)"><p>Card</p></div><pre><code>const n = 1;</code></pre></div>';
    const blocks = parseChatGPTMessage(document.querySelector('#answer')!).blocks;
    const light = document.createElement('div');
    light.append(renderBlocks(document, blocks, defaults));
    const dark = document.createElement('div');
    dark.append(renderBlocks(document, blocks, {...defaults, pdfTheme:'dark'}));
    expect(light.querySelector<HTMLElement>('.visual-card')!.style.backgroundColor).toContain('color-mix');
    expect(dark.querySelector<HTMLElement>('.visual-card')!.style.backgroundColor).toBe('rgb(8, 20, 30)');
    expect(light.querySelector('.code-theme-light')).not.toBeNull();
    expect(dark.querySelector('.code-theme-dark')).not.toBeNull();
    expect(buildPrintStyles(defaults)).not.toContain('@page { background: #18181b; }');
    expect(buildPrintStyles({...defaults, pdfTheme:'dark'})).toContain('@page { background: #18181b; }');
  });
});
