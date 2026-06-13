// Generates public/og.png (1200×630) — the social share card.
// Renders an on-brand HTML card with Chromium (already installed for Playwright)
// using the exact design tokens from src/index.css. Run: node scripts/generate-og.mjs
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { chromium } from '@playwright/test'

const fe = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Resolve a fontsource variable woff2 to a file:// URL so Chromium can embed it. */
function fontUrl(pkg) {
  const dir = path.join(fe, 'node_modules', pkg, 'files')
  const file = readdirSync(dir).find((n) => n.endsWith('.woff2') && n.includes('latin') && n.includes('normal'))
  return pathToFileURL(path.join(dir, file)).href
}

const grotesk = fontUrl('@fontsource-variable/space-grotesk')
const geist = fontUrl('@fontsource-variable/geist')

const STAGES = ['Classify', 'Retrieve', 'Draft', 'QA', 'Route']

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Space Grotesk'; src: url('${grotesk}') format('woff2'); font-weight: 300 700; }
  @font-face { font-family: 'Geist'; src: url('${geist}') format('woff2'); font-weight: 300 700; }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: #0b0d12; color: #e8ebf2; font-family: 'Geist', system-ui, sans-serif;
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(#191d28 1px, transparent 1px),
      linear-gradient(90deg, #191d28 1px, transparent 1px);
    background-size: 56px 56px;
    -webkit-mask-image: radial-gradient(ellipse 75% 70% at 30% 0%, #000 30%, transparent 80%);
  }
  .aurora {
    position: absolute; inset: -10% -5% auto -5%; height: 520px;
    background:
      radial-gradient(40% 60% at 18% 20%, rgba(142,123,255,.45), transparent 70%),
      radial-gradient(38% 55% at 92% 8%, rgba(91,225,230,.32), transparent 70%);
    filter: blur(8px);
  }
  .frame { position: absolute; inset: 0; padding: 72px 80px; display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; gap: 14px; }
  .word { font-family: 'Space Grotesk'; font-size: 30px; font-weight: 600; letter-spacing: -.02em; }
  h1 {
    font-family: 'Space Grotesk'; font-weight: 600; letter-spacing: -.03em;
    font-size: 76px; line-height: 1.02; margin-top: auto; max-width: 18ch;
  }
  .grad { background: linear-gradient(100deg, #a99bff, #7eeef0); -webkit-background-clip: text; background-clip: text; color: transparent; }
  p.sub { margin-top: 26px; font-size: 26px; line-height: 1.4; color: #9aa3b6; max-width: 30ch; }
  .stages { margin-top: auto; display: flex; align-items: center; gap: 10px; }
  .chip {
    font-size: 19px; color: #c4baff; border: 1px solid rgba(142,123,255,.3);
    background: rgba(142,123,255,.08); border-radius: 999px; padding: 8px 16px;
  }
  .arrow { color: #5be1e6; font-size: 18px; }
  .badge {
    margin-left: auto; font-size: 18px; color: #5ce0a3;
    border: 1px solid rgba(62,207,142,.3); background: rgba(62,207,142,.1);
    border-radius: 999px; padding: 8px 16px;
  }
</style></head>
<body>
  <div class="grid"></div>
  <div class="aurora"></div>
  <div class="frame">
    <div class="top">
      <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
        <defs><linearGradient id="g" x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stop-color="#8E7BFF"/><stop offset="1" stop-color="#5BE1E6"/></linearGradient></defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#g)" fill-opacity=".14" stroke="url(#g)" stroke-opacity=".5"/>
        <path d="M8 21c3.2 0 3.2-10 6.4-10 3.2 0 3.2 10 6.4 10" stroke="url(#g)" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="8" cy="21" r="2.4" fill="#8E7BFF"/><circle cx="14.4" cy="11" r="2.4" fill="#a99bff"/>
        <circle cx="20.8" cy="21" r="2.4" fill="#5BE1E6"/><circle cx="24.5" cy="11.5" r="1.6" fill="#5BE1E6"/>
      </svg>
      <span class="word">Nimbus</span>
    </div>
    <h1>Autonomous <span class="grad">support triage</span></h1>
    <p class="sub">Resolve tickets autonomously. Escalate the risky ones to humans.</p>
    <div class="stages">
      ${STAGES.map((s, i) => `<span class="chip">${s}</span>${i < STAGES.length - 1 ? '<span class="arrow">&rarr;</span>' : ''}`).join('')}
      <span class="badge">RAG &middot; QA guardrail &middot; HITL routing</span>
    </div>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: path.join(fe, 'public', 'og.png') })
await browser.close()
console.log('Wrote public/og.png (1200x630)')
