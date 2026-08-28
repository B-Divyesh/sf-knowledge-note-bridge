import './styles.css';
import { buildDemoPlan, parseCards } from './demo-core.js';

const slug = 'knowledge-note-bridge';
const licenseKey = `sb_license:${slug}`;
const verdictKey = `${licenseKey}:verdict`;
const day = 86_400_000;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const demoInput = byId<HTMLTextAreaElement>('demo-source');
const result = byId<HTMLElement>('demo-result');
const live = byId<HTMLElement>('live-status');

function setLive(message: string) {
  if (live) live.textContent = message;
}

function renderDemo() {
  if (!demoInput || !result) return;
  const source = demoInput.value;
  if (!source.trim()) {
    result.innerHTML = '<div class="demo-state"><span aria-hidden="true">○</span><strong>No source cards yet</strong><p>Paste a <code>card</code> block or restore the example.</p><button type="button" data-restore>Restore example</button></div>';
    setLive('No source cards to compare.');
    return;
  }
  try {
    const cards = parseCards(source);
    if (!cards.length) {
      result.innerHTML = '<div class="demo-state"><span aria-hidden="true">○</span><strong>No card fences found</strong><p>Add a fenced <code>card</code> block, then compare again.</p></div>';
      setLive('No card fences found.');
      return;
    }
    const rows = buildDemoPlan(cards);
    const symbols: Record<string, string> = { keep: '=', add: '+', update: '~', rename: '→', archive: '−', blocked: '!' };
    result.innerHTML = `<div class="diff-head"><span>Action</span><span>Stable ID</span><span>Effect on Anki</span></div>${rows.map((row) => `<div class="diff-row" data-kind="${row.kind}"><span class="change"><b aria-hidden="true">${symbols[row.kind]}</b>${row.kind}</span><code>${escapeHtml(row.id)}</code><span>${escapeHtml(row.detail)}</span></div>`).join('')}`;
    const blocked = rows.filter((row) => row.kind === 'blocked').length;
    setLive(`Plan ready: ${rows.length} items, ${blocked} blocked.`);
    byId<HTMLButtonElement>('save-report')?.removeAttribute('disabled');
  } catch (error) {
    result.innerHTML = `<div class="demo-state error"><span aria-hidden="true">!</span><strong>Could not parse this note</strong><p>${escapeHtml(error instanceof Error ? error.message : 'Check the card format.')}</p></div>`;
    setLive('The note could not be parsed.');
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] || char);
}

document.querySelector('[data-compare]')?.addEventListener('click', renderDemo);
document.querySelector('[data-clear]')?.addEventListener('click', () => { if (demoInput) demoInput.value = ''; renderDemo(); });
result?.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).matches('[data-restore]') && demoInput) {
    demoInput.value = demoInput.dataset.example || '';
    renderDemo();
    demoInput.focus();
  }
});

const copyButton = byId<HTMLButtonElement>('copy-install');
copyButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('cargo install --git https://github.com/B-Divyesh/sf-knowledge-note-bridge');
    copyButton.textContent = 'Copied'; setLive('Install command copied.');
  } catch { setLive('Copy was unavailable. Select the install command manually.'); }
});

function cachedValid() {
  try { const cached = JSON.parse(localStorage.getItem(verdictKey) || 'null'); return Boolean(cached?.valid); } catch { return false; }
}

function updateLicenseUI(valid: boolean, message?: string) {
  const badge = byId<HTMLElement>('license-badge');
  if (badge) { badge.textContent = valid ? 'Steward active' : 'Free edition'; badge.dataset.active = String(valid); }
  const save = byId<HTMLButtonElement>('save-report');
  if (save) save.dataset.unlocked = String(valid);
  const notice = byId<HTMLElement>('license-notice');
  if (notice && message) notice.textContent = message;
}

async function verifyLicense(token: string, force = false) {
  let cached: { valid: boolean; checkedAt: number } | null = null;
  try { cached = JSON.parse(localStorage.getItem(verdictKey) || 'null'); } catch { /* ignore invalid local state */ }
  updateLicenseUI(Boolean(cached?.valid));
  if (!force && cached && Date.now() - cached.checkedAt < day) return;
  try {
    const response = await fetch(`https://api.sociobot.in/api/v1/products/${slug}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verification unavailable');
    const verdict = await response.json();
    const state = { valid: verdict.valid === true, checkedAt: Date.now() };
    localStorage.setItem(verdictKey, JSON.stringify(state));
    updateLicenseUI(state.valid, state.valid ? 'License verified. Steward tools are ready.' : 'License no longer active. You can keep using every core CLI feature.');
  } catch {
    updateLicenseUI(Boolean(cached?.valid), 'Could not refresh the license. Cached access remains available; try again when online.');
  }
}

const params = new URLSearchParams(location.search);
const returnedLicense = params.get('license');
if (returnedLicense) {
  localStorage.setItem(licenseKey, returnedLicense);
  history.replaceState({}, '', `${location.pathname}${location.hash}`);
}
const savedLicense = localStorage.getItem(licenseKey);
if (savedLicense) verifyLicense(savedLicense, Boolean(returnedLicense)); else updateLicenseUI(false);

const licenseForm = byId<HTMLFormElement>('license-form');
licenseForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = byId<HTMLInputElement>('license-input');
  const token = input?.value.trim();
  if (!token) { byId<HTMLElement>('license-error')!.textContent = 'Paste the license token from your receipt.'; input?.focus(); return; }
  localStorage.setItem(licenseKey, token);
  byId<HTMLElement>('license-error')!.textContent = '';
  verifyLicense(token, true);
});

byId<HTMLButtonElement>('save-report')?.addEventListener('click', (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  if (button.dataset.unlocked !== 'true') {
    byId<HTMLElement>('license-notice')!.textContent = 'Saving browser demo reports is a Steward convenience. The CLI always writes full reports for free.';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector<HTMLElement>('#steward')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    return;
  }
  if (!result) return;
  localStorage.setItem('knb_demo_report', result.textContent || '');
  setLive('Demo report saved on this device.');
  button.textContent = 'Report saved';
});

const offline = byId<HTMLElement>('offline-state');
function connectivity() { if (offline) offline.hidden = navigator.onLine; }
addEventListener('online', connectivity); addEventListener('offline', connectivity); connectivity();

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
renderDemo();
