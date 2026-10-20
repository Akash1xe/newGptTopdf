import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const bundle = await build({entryPoints:['scripts/long-conversation-fixture.ts'],bundle:true,write:false,format:'iife'});
await mkdir('tmp/pdfs', {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  for (const scenario of ['mounted-lazy', 'virtual']) {
    const page = await browser.newPage();
    await page.route('https://fixture.invalid/**', route => route.fulfill({
      contentType:'text/html',body:'<!doctype html><html><head><title>Long conversation regression</title></head><body></body></html>'
    }));
    await page.goto(`https://fixture.invalid/?${scenario}`);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    console.log(scenario, JSON.stringify(await page.evaluate(() => window.collectionResult)));
    await page.pdf({path:`tmp/pdfs/long-${scenario}.pdf`,printBackground:true,preferCSSPageSize:true});
    await page.close();
  }
} finally { await browser.close(); }
