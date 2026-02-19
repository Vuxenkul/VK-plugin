const BUNDLED_SCRIPTS = [
  {
    id: 'front-end-links',
    file: 'scripts/front-end-links.js'
  }
];

const metadataCache = new Map();

async function loadUserscriptMetadata(scriptDef) {
  if (metadataCache.has(scriptDef.id)) {
    return metadataCache.get(scriptDef.id);
  }

  const raw = await fetch(chrome.runtime.getURL(scriptDef.file)).then((r) => r.text());
  const meta = parseUserscriptMetadata(raw);
  const full = {
    ...scriptDef,
    ...meta
  };
  metadataCache.set(scriptDef.id, full);
  return full;
}

function parseUserscriptMetadata(source) {
  const match = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
  const metadata = {
    name: 'Unnamed script',
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

    sendResponse({ ok: false });
  })();

  return true;
});
