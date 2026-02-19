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

function makeStatusCard(label, yes) {
  const el = document.createElement('div');
  el.className = `status ${yes ? 'ok' : 'no'}`;

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = yes ? 'Yes' : 'No';

  el.appendChild(labelEl);
  el.appendChild(valueEl);
  return el;
}

function makeHint(text, className = '') {
  const hint = document.createElement('div');
  hint.className = `hint ${className}`.trim();
  hint.textContent = text;
  return hint;
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
  if (!scripts.length) {
    list.textContent = 'No bundled scripts found.';
    return;
  }

  for (const script of scripts) {
    const card = document.createElement('div');
    card.className = 'script-card';

    const row = document.createElement('div');
    row.className = 'row';

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'name';
    title.textContent = script.name;

    const version = document.createElement('div');
    version.className = 'meta';
    version.innerHTML = `v${script.version}<span class="badge">bundled</span>`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(version);

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

    row.appendChild(titleWrap);
    row.appendChild(toggleWrap);
    card.appendChild(row);

    const statusGrid = document.createElement('div');
    statusGrid.className = 'status-grid';
    statusGrid.appendChild(makeStatusCard('Matches this page', script.matchesPage));

    const runtime = runningMap[script.id] || {};
    const ran = !!runtime.ran;
    statusGrid.appendChild(makeStatusCard('Running / ran', ran));
    card.appendChild(statusGrid);

    if (runtime.error) {
      card.appendChild(makeHint(`Execution error: ${runtime.error}`, 'error'));
    }

    if (!toggle.checked && ran) {
      card.appendChild(makeHint('Reload tab to fully disable effects.'));
    }

    list.appendChild(card);
  }
}

render();
