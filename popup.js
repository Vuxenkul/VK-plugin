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
  chip.innerHTML = `${label}: <b>${yes ? 'Ja' : 'Nej'}</b>`;
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

function formatDateTime(timestamp) {
  if (!timestamp) return 'Aldrig';
  try {
    return new Date(timestamp).toLocaleString();
  } catch (_err) {
    return 'Okänt';
  }
}

function renderUpdateBanner(update) {
  const banner = document.getElementById('update-banner');
  banner.innerHTML = '';
  banner.className = '';

  const currentVersion = update?.currentVersion || chrome.runtime.getManifest().version;
  const latestVersion = update?.latestVersion || currentVersion;
  const checkedText = `Senast kontrollerad: ${formatDateTime(update?.checkedAt)}`;

  if (update?.updateAvailable) {
    banner.className = 'update-banner available';

    const title = document.createElement('div');
    title.className = 'update-title';
    title.textContent = `Uppdatering tillgänglig: v${latestVersion}`;

    const info = document.createElement('div');
    info.className = 'update-sub';
    info.textContent = `Nuvarande: v${currentVersion}`;

    banner.appendChild(title);
    banner.appendChild(info);

    if (update?.notes) {
      const notes = document.createElement('div');
      notes.className = 'update-sub';
      notes.textContent = update.notes;
      banner.appendChild(notes);
    }

    const actions = document.createElement('div');
    actions.className = 'update-actions';

    if (update.downloadUrl) {
      const link = document.createElement('a');
      link.className = 'update-btn';
      link.href = update.downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Ladda ner uppdatering';
      actions.appendChild(link);
    } else {
      const warn = document.createElement('div');
      warn.className = 'update-sub';
      warn.textContent = 'Nedladdningslänk saknas. Kontakta administratör.';
      actions.appendChild(warn);
    }

    const refresh = document.createElement('button');
    refresh.className = 'update-btn ghost';
    refresh.type = 'button';
    refresh.textContent = 'Kontrollera igen';
    refresh.addEventListener('click', async () => {
      await checkForUpdates(true);
    });
    actions.appendChild(refresh);

    banner.appendChild(actions);

    const checked = document.createElement('div');
    checked.className = 'update-sub tiny';
    checked.textContent = checkedText;
    banner.appendChild(checked);
    return;
  }

  banner.className = 'update-banner none';

  const title = document.createElement('div');
  title.className = 'update-title';
  title.textContent = `Uppdaterad (v${currentVersion})`;
  banner.appendChild(title);

  if (update?.error) {
    const err = document.createElement('div');
    err.className = 'update-sub';
    err.textContent = `Varning vid uppdateringskontroll: ${update.error}`;
    banner.appendChild(err);
  }

  const checked = document.createElement('div');
  checked.className = 'update-sub tiny';
  checked.textContent = checkedText;
  banner.appendChild(checked);

  const refresh = document.createElement('button');
  refresh.className = 'update-btn ghost';
  refresh.type = 'button';
  refresh.textContent = 'Kontrollera igen';
  refresh.addEventListener('click', async () => {
    await checkForUpdates(true);
  });
  banner.appendChild(refresh);
}

async function checkForUpdates(force = false) {
  const response = await chrome.runtime.sendMessage({
    type: force ? 'CHECK_FOR_UPDATES' : 'GET_UPDATE_STATUS'
  });
  renderUpdateBanner(response?.update || null);
}

async function render() {
  const list = document.getElementById('list');
  try {
    const tab = await getActiveTab();

    await checkForUpdates(false);

    if (!tab || !tab.url || !/^https?:\/\//.test(tab.url)) {
      list.textContent = 'Öppna en webbflik för att utvärdera skript.';
      return;
    }

    const response = await chrome.runtime.sendMessage({ type: 'GET_SCRIPTS_FOR_TAB', url: tab.url });
    const runningMap = await getRunningMap(tab.id);
    const scripts = response?.scripts || [];

    list.innerHTML = '';
    list.className = '';

    if (!scripts.length) {
      list.className = 'list-empty';
      list.textContent = 'Inga medföljande skript hittades.';
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

      const titleText = document.createElement('span');
      titleText.textContent = script.name;
      title.appendChild(titleText);

      if (script.description) {
        const help = document.createElement('button');
        help.type = 'button';
        help.className = 'desc-help';
        help.setAttribute('aria-label', `Beskrivning: ${script.name}`);
        help.textContent = '?';

        const tip = document.createElement('span');
        tip.className = 'desc-tip';
        tip.textContent = script.description;
        help.appendChild(tip);

        title.appendChild(help);
      }

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `v${script.version}<span class="badge">medföljer</span>`;

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

      const matchChip = makeChip('Matchar', script.matchesPage, 'match-chip');
      const dot = document.createElement('span');
      dot.className = `match-dot ${script.matchesPage ? 'on' : ''}`;
      matchChip.prepend(dot);

      status.appendChild(matchChip);
      status.appendChild(makeChip('Körde', ran));
      card.appendChild(status);

      if (script.loadError) {
        const err = document.createElement('div');
        err.className = 'error-row';
        err.appendChild(makeMaterialErrorIcon());
        const text = document.createElement('span');
        text.textContent = `Kunde inte läsa skriptfil: ${script.loadError}`;
        err.appendChild(text);
        card.appendChild(err);
      }

      if (runtime.error) {
        const err = document.createElement('div');
        err.className = 'error-row';
        err.appendChild(makeMaterialErrorIcon());
        const text = document.createElement('span');
        text.textContent = `Kunde inte köras: ${runtime.error}`;
        err.appendChild(text);
        card.appendChild(err);
      }

      if (!toggle.checked && ran) {
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = 'Ladda om fliken för att helt stänga av effekter.';
        card.appendChild(hint);
      }

      list.appendChild(card);
    }
  } catch (err) {
    list.className = 'list-empty';
    list.textContent = `Kunde inte läsa skriptstatus: ${String(err)}`;
  }
}

render();
