async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function getRunningMap(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__VK_PLUGIN_RUNTIME || {}
    });
    return result?.result || {};
  } catch (_err) {
    return {};
  }
}

function makeChip(label, yes, extraClass = '') {
  const chip = document.createElement('span');
  chip.className = `chip ${yes ? 'ok' : 'no'} ${extraClass}`.trim();
  chip.innerHTML = `${label}: <b>${yes ? 'Yes' : 'No'}</b>`;
  return chip;
}

function makeMaterialErrorIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'error-icon');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'currentColor');
  // Material icon: error
  path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z');
  svg.appendChild(path);
  return svg;
}

async function render() {
  const list = document.getElementById('list');
  const tab = await getActiveTab();

  if (!tab || !tab.url || !/^https?:\/\//.test(tab.url)) {
    list.textContent = 'Open a website tab to evaluate scripts.';
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: 'GET_SCRIPTS_FOR_TAB', url: tab.url });
  const runningMap = await getRunningMap(tab.id);
  const scripts = response?.scripts || [];

  list.innerHTML = '';
  list.className = '';

  if (!scripts.length) {
    list.className = 'list-empty';
    list.textContent = 'No bundled scripts found.';
    return;
  }

  for (const script of scripts) {
    const card = document.createElement('div');
    card.className = 'item';

    const row = document.createElement('div');
    row.className = 'top';

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'name';
    title.textContent = script.name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `v${script.version}<span class="badge">bundled</span>`;

    left.appendChild(title);
    left.appendChild(meta);

    const toggleWrap = document.createElement('label');
    toggleWrap.className = 'switch';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = script.enabled;
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggleWrap.appendChild(toggle);
    toggleWrap.appendChild(slider);

    toggle.addEventListener('change', async () => {
      await chrome.runtime.sendMessage({
        type: 'SET_SCRIPT_ENABLED',
        scriptId: script.id,
        enabled: toggle.checked,
        tabId: tab.id
      });
      render();
    });

    row.appendChild(left);
    row.appendChild(toggleWrap);
    card.appendChild(row);

    const runtime = runningMap[script.id] || {};
    const ran = !!runtime.ran;

    const status = document.createElement('div');
    status.className = 'status';

    const matchChip = makeChip('Matches', script.matchesPage, 'match-chip');
    const dot = document.createElement('span');
    dot.className = `match-dot ${script.matchesPage ? 'on' : ''}`;
    matchChip.prepend(dot);

    status.appendChild(matchChip);
    status.appendChild(makeChip('Ran', ran));
    card.appendChild(status);

    if (runtime.error) {
      const err = document.createElement('div');
      err.className = 'error-row';
      err.appendChild(makeMaterialErrorIcon());
      const text = document.createElement('span');
      text.textContent = `Could not run: ${runtime.error}`;
      err.appendChild(text);
      card.appendChild(err);
    }

    if (!toggle.checked && ran) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Reload tab to fully disable effects.';
      card.appendChild(hint);
    }

    list.appendChild(card);
  }
}

render();
