// Local, isolated browser regression; never connects to a personal browser profile.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const bundle = await build({ entryPoints:['scripts/visual-export-fixture.ts'], bundle:true, write:false, format:'iife' });
await mkdir('tmp/visual-export', {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
  for (const theme of ['dark','light']) {
    const page = await browser.newPage({viewport:{width:900,height:1400}});
    await page.route('https://fixture.invalid/**', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
    await page.goto(`https://fixture.invalid/?theme=${theme}`);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.emulateMedia({media:'print'});
    const data = await page.evaluate(() => ({
      progress:[...document.querySelectorAll('.visual-progress')].map(el=>getComputedStyle(el,'::after').width),
      slider:[...document.querySelectorAll('.visual-slider')].map(el=>el.getBoundingClientRect().width),
      text:document.body.textContent,
      panels:document.querySelectorAll('.visual-panel').length,
      images:document.querySelectorAll('img').length,
      lowColor:getComputedStyle([...document.querySelectorAll('.source-color')].find(el=>el.textContent.includes('Previously unreadable'))).color,
      neutralColor:getComputedStyle([...document.querySelectorAll('.source-color')].find(el=>el.textContent.includes('React · User interface'))).color,
      accentColor:getComputedStyle([...document.querySelectorAll('.source-color')].find(el=>el.textContent.includes('Green success accent'))).color,
      bodyColor:getComputedStyle(document.querySelector('.export-document')).color
    }));
    assert.equal(data.progress.length,4); assert.equal(parseFloat(data.progress[3]),0);
    assert(data.slider.every(width=>width>100)); assert.equal(data.slider.length,2);
    assert(!data.text.includes('Copy')); assert(data.text.includes('Open PDF')); assert(data.images>=2);
    if(theme==='dark') { assert(data.panels>=2); assert.notEqual(data.lowColor,'rgb(20, 20, 20)'); }
    if(theme==='light') {
      assert(data.panels>=2);
      assert.equal(data.lowColor,'rgb(0, 0, 0)');
      assert.equal(data.neutralColor,'rgb(0, 0, 0)');
      assert.equal(data.bodyColor,'rgb(0, 0, 0)');
    } else {
      assert.equal(data.neutralColor,'rgb(240, 240, 240)');
      assert.equal(data.bodyColor,'rgb(244, 244, 245)');
    }
    assert.notEqual(data.accentColor,'rgb(0, 0, 0)');
    await page.screenshot({path:`tmp/visual-export/${theme}.png`,fullPage:true});
    if (process.argv.includes('--pdf')) await page.pdf({path:`tmp/visual-export/${theme}.pdf`,printBackground:true,preferCSSPageSize:true});
    console.log(theme, JSON.stringify(data));
    await page.close();
  }
} finally { await browser.close(); }
