const BUNDLED_SCRIPTS = [
  {
    id: 'front-end-links',
    file: 'scripts/front-end-links.js'
  },
  {
    id: 'backend-varugrupper',
    file: 'scripts/backend-varugrupper.js'
  },
  {
    id: 'backend-top_n_side-bar',
    file: 'scripts/backend-top_n_side-bar.user.js'
  },
  {
    id: 'backend-edit_product',
    file: 'scripts/backend-edit_product.user.js'
  },
  {
    id: 'backend-products-language-filters',
    file: 'scripts/backend-products-language-filters.user.js'
  },
  {
    id: 'backend-products_multiedit',
    file: 'scripts/backend-products_multiedit.user.js'
  },
  {
    id: 'backend-conditional-filters',
    file: 'scripts/backend-conditional-filters.user.js'
  },
  {
    id: 'backend-images',
    file: 'scripts/backend-images.user.js'
  }
];

const UPDATE_MANIFEST_URL = 'https://wiki.vuxenkul.se/public/vk-plugin/latest.json';
const UPDATE_STATE_KEY = 'updateState';
const UPDATE_CHECK_MIN_INTERVAL_MS = 60 * 60 * 1000;

const metadataCache = new Map();

async function loadUserscriptMetadata(scriptDef) {
  if (metadataCache.has(scriptDef.id)) {
    return metadataCache.get(scriptDef.id);
  }

  const fallback = {
    ...scriptDef,
    name: scriptDef.id,
    version: '0.0.0',
    matches: [],
    excludes: [],
    loadError: null
  };

  try {
    const response = await fetch(chrome.runtime.getURL(scriptDef.file));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const raw = await response.text();
    const meta = parseUserscriptMetadata(raw);
    const full = {
      ...fallback,
      ...meta
    };
    metadataCache.set(scriptDef.id, full);
    return full;
  } catch (err) {
    const full = {
      ...fallback,
      loadError: String(err)
    };
    metadataCache.set(scriptDef.id, full);
    return full;
  }
}

function parseUserscriptMetadata(source) {
  const match = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
  const metadata = {
    name: 'Namnlöst skript',
    description: '',
    version: '0.0.0',
    matches: [],
    excludes: []
  };

  if (!match) {
    return metadata;
  }

  const lines = match[1].split('\n');
  for (const line of lines) {
    const tagMatch = line.match(/^\s*\/\/\s*@([\w:-]+)\s+(.+)\s*$/);
    if (!tagMatch) continue;
    const [, tag, value] = tagMatch;
    if (tag === 'name') metadata.name = value.trim();
    if (tag === 'description') metadata.description = value.trim();
    if (tag === 'version') metadata.version = value.trim();
    if (tag === 'match') metadata.matches.push(value.trim());
    if (tag === 'exclude') metadata.excludes.push(value.trim());
  }

  return metadata;
}

function wildcardToRegex(pattern) {
  if (pattern === '<all_urls>') {
    return /^https?:\/\/.+$/;
  }

  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(`^${escaped}$`);
}

function matchesUrl(url, patterns) {
  if (!patterns.length) return false;
  return patterns.some((pattern) => wildcardToRegex(pattern).test(url));
}

function scriptMatches(script, url) {
  if (!matchesUrl(url, script.matches)) return false;
  if (script.excludes.length && matchesUrl(url, script.excludes)) return false;
  return true;
}

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '');
}

function compareVersions(a, b) {
  const cleanA = normalizeVersion(a);
  const cleanB = normalizeVersion(b);

  if (!cleanA && !cleanB) return 0;
  if (!cleanA) return -1;
  if (!cleanB) return 1;

  const aParts = cleanA.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const bParts = cleanB.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const max = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < max; i += 1) {
    const left = aParts[i] || 0;
    const right = bParts[i] || 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

function buildDefaultUpdateState() {
  return {
    checkedAt: null,
    updateAvailable: false,
    currentVersion: chrome.runtime.getManifest().version,
    latestVersion: null,
    downloadUrl: null,
    notes: null,
    error: null
  };
}

async function getUpdateState() {
  const stored = await chrome.storage.local.get(UPDATE_STATE_KEY);
  return {
    ...buildDefaultUpdateState(),
    ...(stored[UPDATE_STATE_KEY] || {})
  };
}

async function setUpdateState(state) {
  await chrome.storage.local.set({ [UPDATE_STATE_KEY]: state });
}

function sanitizeDownloadUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== 'wiki.vuxenkul.se') return null;
    return parsed.toString();
  } catch (_err) {
    return null;
  }
}

function sanitizeManifestPayload(payload) {
  const latestVersion = normalizeVersion(payload?.latestVersion);
  const downloadUrl = sanitizeDownloadUrl(payload?.downloadUrl);
  const notes = typeof payload?.notes === 'string' ? payload.notes.trim() : null;
  return { latestVersion, downloadUrl, notes };
}

async function checkForExtensionUpdate({ force = false } = {}) {
  const now = Date.now();
  const previous = await getUpdateState();

  if (!force && previous.checkedAt && now - previous.checkedAt < UPDATE_CHECK_MIN_INTERVAL_MS) {
    return previous;
  }

  const currentVersion = chrome.runtime.getManifest().version;

  try {
    const response = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const parsed = sanitizeManifestPayload(payload);
    if (!parsed.latestVersion) {
      throw new Error('Saknar latestVersion i uppdateringsmanifestet');
    }

    const updateAvailable = compareVersions(parsed.latestVersion, currentVersion) > 0;
    const state = {
      checkedAt: now,
      updateAvailable,
      currentVersion,
      latestVersion: parsed.latestVersion,
      downloadUrl: parsed.downloadUrl,
      notes: parsed.notes,
      error: parsed.downloadUrl ? null : 'Ogiltig eller saknad downloadUrl i uppdateringsmanifestet'
    };

    await setUpdateState(state);
    return state;
  } catch (err) {
    const state = {
      ...previous,
      checkedAt: now,
      currentVersion,
      error: String(err)
    };
    await setUpdateState(state);
    return state;
  }
}

async function getEnabledMap() {
  const stored = await chrome.storage.local.get('enabledScripts');
  return stored.enabledScripts || {};
}

async function isScriptEnabled(scriptId) {
  const map = await getEnabledMap();
  return map[scriptId] !== false;
}

async function setScriptEnabled(scriptId, enabled) {
  const map = await getEnabledMap();
  map[scriptId] = enabled;
  await chrome.storage.local.set({ enabledScripts: map });
}

async function getAllScripts() {
  return Promise.all(BUNDLED_SCRIPTS.map(loadUserscriptMetadata));
}

async function injectScript(tabId, script) {
  const [state] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (scriptId) => {
      window.__VK_PLUGIN_RUNTIME = window.__VK_PLUGIN_RUNTIME || {};
      return window.__VK_PLUGIN_RUNTIME[scriptId] || null;
    },
    args: [script.id]
  });

  if (state?.result?.ran) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [script.file]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (scriptId) => {
        window.__VK_PLUGIN_RUNTIME = window.__VK_PLUGIN_RUNTIME || {};
        window.__VK_PLUGIN_RUNTIME[scriptId] = {
          ran: true,
          error: null,
          lastRunAt: Date.now()
        };
      },
      args: [script.id]
    });
  } catch (err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (scriptId, message) => {
        window.__VK_PLUGIN_RUNTIME = window.__VK_PLUGIN_RUNTIME || {};
        window.__VK_PLUGIN_RUNTIME[scriptId] = {
          ran: false,
          error: message,
          lastRunAt: Date.now()
        };
      },
      args: [script.id, String(err)]
    });
  }
}

async function evaluateAndInjectForTab(tabId, url) {
  if (!url || !/^https?:\/\//.test(url)) return;

  const scripts = await getAllScripts();
  for (const script of scripts) {
    const enabled = await isScriptEnabled(script.id);
    if (!enabled) continue;
    if (!scriptMatches(script, url)) continue;
    await injectScript(tabId, script);
  }
}

async function handleTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await evaluateAndInjectForTab(tabId, tab.url);
}

chrome.runtime.onInstalled.addListener(() => {
  checkForExtensionUpdate({ force: true });
});

chrome.runtime.onStartup.addListener(() => {
  checkForExtensionUpdate();
});

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  await evaluateAndInjectForTab(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return;
  await evaluateAndInjectForTab(details.tabId, details.url);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'GET_SCRIPTS_FOR_TAB') {
      const scripts = await getAllScripts();
      const enabledMap = await getEnabledMap();
      const result = scripts.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version,
        matchesPage: scriptMatches(s, message.url),
        enabled: enabledMap[s.id] !== false
      }));
      sendResponse({ scripts: result });
      return;
    }

    if (message?.type === 'SET_SCRIPT_ENABLED') {
      await setScriptEnabled(message.scriptId, message.enabled);
      if (message.enabled && message.tabId) {
        await handleTab(message.tabId);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'GET_UPDATE_STATUS') {
      const state = await checkForExtensionUpdate();
      sendResponse({ update: state });
      return;
    }

    if (message?.type === 'CHECK_FOR_UPDATES') {
      const state = await checkForExtensionUpdate({ force: true });
      sendResponse({ update: state });
      return;
    }

    sendResponse({ ok: false });
  })();

  return true;
});
