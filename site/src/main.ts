import './styles.css';
import { buildDemoPlan, parseCards, sampleMarkdown } from './demo-core.js';

const slug = 'knowledge-note-bridge';
const licenseKey = `sb_license:${slug}`;
const verdictKey = `${licenseKey}:verdict`;
const demoPrefix = 'demo:knb:';
const demoSourceKey = `${demoPrefix}source`;
const day = 86_400_000;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const setLive = (message: string) => {
  const live = byId<HTMLElement>('live-status');
  if (live) live.textContent = message;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character] || character
  ));
}

function renderDemo() {
  const input = byId<HTMLTextAreaElement>('demo-source');
  const result = byId<HTMLElement>('demo-result');
  if (!input || !result) return;
  if (!input.value.trim()) {
    result.innerHTML = '<div class="demo-state"><span aria-hidden="true">○</span><strong>No sample cards</strong><p>Reset the demo or paste a card block.</p><button type="button" data-restore>Reset demo</button></div>';
    setLive('There are no sample cards to compare.');
    return;
  }
  try {
    const cards = parseCards(input.value);
    if (!cards.length) {
      result.innerHTML = '<div class="demo-state"><span aria-hidden="true">○</span><strong>No card blocks found</strong><p>Add a fenced card block, then compare again.</p></div>';
      setLive('No card blocks were found.');
      return;
    }
    const rows = buildDemoPlan(cards);
    const symbols: Record<string, string> = { keep: '=', add: '+', update: '~', rename: '→', archive: '−', blocked: '!' };
    const counts = rows.reduce<Record<string, number>>((all, row) => {
      all[row.kind] = (all[row.kind] || 0) + 1;
      return all;
    }, {});
    result.innerHTML = `<p class="plan-summary">${rows.length} items · ${counts.blocked || 0} blocked · No Anki changes</p><div class="diff-head"><span>Action</span><span>Stable ID</span><span>Effect on Anki</span></div>${rows.map((row) => `<div class="diff-row" data-kind="${row.kind}"><span class="change"><b aria-hidden="true">${symbols[row.kind]}</b>${row.kind}</span><code>${escapeHtml(row.id)}</code><span>${escapeHtml(row.detail)}</span></div>`).join('')}`;
    setLive(`Plan ready: ${rows.length} items, ${counts.blocked || 0} blocked. Nothing was written.`);
  } catch (error) {
    result.innerHTML = `<div class="demo-state error"><span aria-hidden="true">!</span><strong>Could not read this Markdown</strong><p>${escapeHtml(error instanceof Error ? error.message : 'Check the card format.')}</p><button type="button" data-restore>Reset demo</button></div>`;
    setLive('The sample Markdown could not be read.');
  }
}

function clearDemoStorage() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(demoPrefix)) sessionStorage.removeItem(key);
    }
  } catch {
    // The demo remains usable in memory if storage is unavailable.
  }
}

function resetDemo(focus = false) {
  const input = byId<HTMLTextAreaElement>('demo-source');
  if (!input) return;
  clearDemoStorage();
  input.value = sampleMarkdown;
  renderDemo();
  setLive('The four sample cards were restored.');
  if (focus) input.focus();
}

function initDemo() {
  const input = byId<HTMLTextAreaElement>('demo-source');
  if (!input) return;
  try {
    input.value = sessionStorage.getItem(demoSourceKey) || sampleMarkdown;
  } catch {
    input.value = sampleMarkdown;
  }
  input.addEventListener('input', () => {
    try { sessionStorage.setItem(demoSourceKey, input.value); } catch { /* use memory only */ }
  });
  document.querySelector('[data-compare]')?.addEventListener('click', renderDemo);
  document.querySelector('[data-clear]')?.addEventListener('click', () => {
    input.value = '';
    try { sessionStorage.setItem(demoSourceKey, ''); } catch { /* use memory only */ }
    renderDemo();
  });
  byId<HTMLButtonElement>('reset-demo')?.addEventListener('click', () => resetDemo(true));
  byId<HTMLAnchorElement>('start-real')?.addEventListener('click', clearDemoStorage);
  byId<HTMLElement>('demo-result')?.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).matches('[data-restore]')) resetDemo(true);
  });
  addEventListener('pagehide', clearDemoStorage);
  renderDemo();
}

function cachedLicenseVerdict() {
  try {
    return JSON.parse(localStorage.getItem(verdictKey) || 'null') as { valid: boolean; checkedAt: number } | null;
  } catch {
    return null;
  }
}

function updateLicenseUI(valid: boolean, message?: string) {
  const save = byId<HTMLButtonElement>('save-report');
  if (save) save.dataset.unlocked = String(valid);
  const notice = byId<HTMLElement>('license-notice');
  if (notice && message) notice.textContent = message;
}

async function verifyLicense(token: string, force = false) {
  const cached = cachedLicenseVerdict();
  updateLicenseUI(Boolean(cached?.valid));
  if (!force && cached && Date.now() - cached.checkedAt < day) return;
  try {
    const response = await fetch(`https://api.sociobot.in/api/v1/products/${slug}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verification unavailable');
    const verdict = await response.json();
    const state = { valid: verdict.valid === true, checkedAt: Date.now() };
    localStorage.setItem(verdictKey, JSON.stringify(state));
    updateLicenseUI(state.valid, state.valid
      ? 'License verified. Steward browser features are ready.'
      : 'This license is not active. Every CLI command remains available.');
  } catch {
    updateLicenseUI(Boolean(cached?.valid), 'The license check could not finish. Try again when you are online.');
  }
}

function initLicense() {
  const parameters = new URLSearchParams(location.search);
  const returnedLicense = parameters.get('license');
  if (returnedLicense) {
    localStorage.setItem(licenseKey, returnedLicense);
    history.replaceState({}, '', `${location.pathname}${location.hash}`);
  }
  const savedLicense = localStorage.getItem(licenseKey);
  if (savedLicense) verifyLicense(savedLicense, Boolean(returnedLicense));
  else updateLicenseUI(false);

  byId<HTMLFormElement>('license-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = byId<HTMLInputElement>('license-input');
    const token = input?.value.trim();
    const error = byId<HTMLElement>('license-error');
    if (!token) {
      if (error) error.textContent = 'Paste the license token from your receipt.';
      input?.focus();
      return;
    }
    localStorage.setItem(licenseKey, token);
    if (error) error.textContent = '';
    verifyLicense(token, true);
  });

  byId<HTMLButtonElement>('save-report')?.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    if (button.dataset.unlocked !== 'true') {
      const notice = byId<HTMLElement>('license-notice');
      if (notice) notice.textContent = 'A Steward license is required to save the bundled sample report.';
      byId<HTMLInputElement>('license-input')?.focus();
      return;
    }
    localStorage.setItem('knb_saved_report', JSON.stringify({
      saved_at: new Date().toISOString(),
      summary: { add: 1, update: 1, rename: 1, archive: 1, blocked: 0 }
    }));
    button.textContent = 'Sample report saved';
    setLive('The bundled sample report was saved on this device.');
  });
}

function initCommon() {
  const copyButton = byId<HTMLButtonElement>('copy-install');
  copyButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('cargo install --git https://github.com/B-Divyesh/sf-knowledge-note-bridge');
      copyButton.textContent = 'Command copied';
      setLive('The install command was copied.');
    } catch {
      setLive('Copy was unavailable. Select the install command manually.');
    }
  });
  const offline = byId<HTMLElement>('offline-state');
  const showConnection = () => { if (offline) offline.hidden = navigator.onLine; };
  addEventListener('online', showConnection);
  addEventListener('offline', showConnection);
  showConnection();
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

const wantsDemo = document.body.dataset.page === 'home' && new URLSearchParams(location.search).get('demo') === '1';
if (wantsDemo) {
  location.replace('/demo/');
} else {
  initCommon();
  if (document.body.dataset.page === 'demo') initDemo();
  if (document.body.dataset.page === 'home') initLicense();
}
