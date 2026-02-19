async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function getRunningMap(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__VK_PLUGIN_RAN || {}
    });
    return result?.result || {};
  } catch (_err) {
    return {};
  }
}

function makeStatusLine(label, yes) {
  const el = document.createElement('div');
  el.className = `status ${yes ? 'ok' : 'no'}`;
  el.textContent = `${label}: ${yes ? 'yes' : 'no'}`;
  return el;
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
    const title = document.createElement('strong');
    title.textContent = script.name;
    const version = document.createElement('div');
    version.className = 'meta';
    version.textContent = `v${script.version}`;
    titleWrap.appendChild(title);
    titleWrap.appendChild(version);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = script.enabled;

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
    row.appendChild(toggle);

    card.appendChild(row);
    card.appendChild(makeStatusLine('matches this page', script.matchesPage));

    const ran = !!runningMap[script.id];
    card.appendChild(makeStatusLine('running/ran', ran));

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
