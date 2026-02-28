// ==UserScript==
// @name         Backend Navigation - Topbar-sök och snabb länk till Wiki
// @description  Lägger till en sökruta i topbaren för snabb navigering i sidomenyn samt en tydlig genväg till Vuxenkul Wiki direkt i backend-gränssnittet.
// @version      1.0
// @match        https://vuxenkul.se/butikadmin/*
// ==/UserScript==

(function () {
  'use strict';

  /*──────── Helpers ────────*/
  const waitFor = (sel) => new Promise((resolve) => {
    const found = document.querySelector(sel);
    if (found) return resolve(found);
    const mo = new MutationObserver(() => {
      const el = document.querySelector(sel);
      if (el) { mo.disconnect(); resolve(el); }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  });
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /*──────── Styles ────────*/
  const css = `
  /* Topbar search */
  .wgr-topsearch{display:flex;align-items:center;gap:10px;position:relative;margin-left:12px}
  .wgr-topsearch__input{width:220px;padding:6px 10px;border:2px solid #ff2471;border-radius:20px;font-size:13px;outline:none;transition:width .15s ease, box-shadow .15s ease}
  .wgr-topsearch__input:focus{width:280px;box-shadow:0 0 0 2px rgba(255,36,113,.2)}
  .wgr-topsearch__results{display:none;position:absolute;top:110%;left:0;width:360px;max-height:300px;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 16px rgba(0,0,0,.12);z-index:99999}
  .wgr-topsearch__results ul{list-style:none;margin:0;padding:6px 0}
  .wgr-topsearch__results li{padding:8px 10px;cursor:pointer;line-height:1.25}
  .wgr-topsearch__results li + li{border-top:1px solid #f3f4f6}
  .wgr-topsearch__results li:hover,.wgr-topsearch__results li.is-active{background:#f9fafb}
  .wgr-topsearch__section{display:block;font-size:11px;color:#6b7280;margin-bottom:2px}
  .wgr-topsearch__label{font-size:13px;color:#111827;white-space:nowrap}
  .wgr-topsearch__label strong{font-weight:700;color:#1f2937}
  .wgr-topsearch__empty{padding:10px;color:#6b7280;font-size:12px}

  /* Vuxenkul Wiki styling */
  .vk-wiki-icon{color:#ffbe00;fill:#ffbe00}
  .vk-wiki-text{
    color:#ffbe00 !important;
    font-size:18px !important;
    font-weight:700 !important;
  }

  @media (max-width: 980px){
    .wgr-topsearch__input{width:160px}
    .wgr-topsearch__input:focus{width:220px}
    .wgr-topsearch__results{width:280px}
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  async function init() {
    const topBar = await waitFor('.top-bar');
    const sidebar = await waitFor('.nav-block.primary-menu');

    /*──────── Index sidebar submenu links (exclude .primary-menu__item) ────────*/
    const entries = [];
    sidebar.querySelectorAll('.primary-menu__list').forEach(listItem => {
      const section = listItem.querySelector('.primary-menu__text')?.textContent?.trim() || '';
      listItem.querySelectorAll('.primary-menu__submenu a.primary-menu__submenu__item').forEach(a => {
        const label = a.textContent.trim().replace(/\s+/g, ' ');
        const href = a.getAttribute('href') || '';
        entries.push({ section, label, href, text: (section + ' ' + label).toLowerCase() });
      });
    });

    /*──────── Insert search after "Antal besökare i webbutiken" ────────*/
    const visitorItem = [...topBar.querySelectorAll('.top-bar__item')]
      .find(n => /Antal besökare i webbutiken/i.test(n.textContent || ''));
    const host = document.createElement('div');
    host.className = 'wgr-topsearch';
    host.innerHTML = `
      <input type="search" class="wgr-topsearch__input" placeholder="Sök i sidomenyn…" aria-label="Sök i sidomenyn">
      <div class="wgr-topsearch__results" role="listbox"><ul></ul></div>
    `;
    if (visitorItem && visitorItem.parentNode) {
      visitorItem.parentNode.insertBefore(host, visitorItem.nextSibling);
    } else {
      (topBar.querySelector('.top-bar__menu') || topBar).prepend(host);
    }

    const input = host.querySelector('.wgr-topsearch__input');
    const resultsBox = host.querySelector('.wgr-topsearch__results');
    const list = resultsBox.querySelector('ul');
    let activeIndex = -1;

    const highlight = (text, q) => {
      if (!q) return text;
      const re = new RegExp(`(${escapeRe(q)})`, 'ig');
      return text.replace(re, '<strong>$1</strong>');
    };

    const setActive = (i) => {
      const items = list.querySelectorAll('li');
      items.forEach(el => el.classList.remove('is-active'));
      if (i >= 0 && i < items.length) {
        items[i].classList.add('is-active');
        activeIndex = i;
        items[i].scrollIntoView({ block: 'nearest' });
      }
    };

    const closeResults = () => {
      resultsBox.style.display = 'none';
      list.innerHTML = '';
      activeIndex = -1;
    };

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = input.value.trim().toLowerCase();
        if (!q) { closeResults(); return; }
        const hits = entries
          .map(e => {
            const inLabel = e.label.toLowerCase().includes(q);
            const inSection = e.section.toLowerCase().includes(q);
            const score = (inLabel ? 2 : 0) + (inSection ? 1 : 0);
            return score ? { ...e, score } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
        list.innerHTML = '';
        if (!hits.length) {
          resultsBox.style.display = 'block';
          list.innerHTML = `<div class="wgr-topsearch__empty">Inga träffar</div>`;
          return;
        }
        const frag = document.createDocumentFragment();
        hits.forEach((hit, idx) => {
          const li = document.createElement('li');
          li.setAttribute('role', 'option');
          li.dataset.href = hit.href;
          li.innerHTML = `
            <span class="wgr-topsearch__section">${hit.section}</span>
            <span class="wgr-topsearch__label">${highlight(hit.label, q)}</span>
          `;
          li.addEventListener('click', () => { window.location.href = hit.href; });
          li.addEventListener('mousemove', () => setActive(idx));
          frag.appendChild(li);
        });
        list.appendChild(frag);
        resultsBox.style.display = 'block';
      }, 100);
    });

    input.addEventListener('keydown', (e) => {
      const isOpen = resultsBox.style.display === 'block';
      if (e.key === 'Escape') { closeResults(); input.blur(); return; }
      if (!isOpen) return;
      const items = list.querySelectorAll('li');
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const target = activeIndex >= 0 ? items[activeIndex] : items[0];
        if (target) window.location.href = target.dataset.href;
      }
    });

    document.addEventListener('click', (e) => { if (!host.contains(e.target)) closeResults(); });

    /*──────── Insert "Vuxenkul Wiki" before Kontrollpanelen ────────*/
    const firstListItem = sidebar.querySelector('.primary-menu__list'); // Kontrollpanelen item
    const wikiLi = document.createElement('li');
    wikiLi.className = 'primary-menu__list';
    wikiLi.innerHTML = `
      <a class="primary-menu__item" href="https://wiki.vuxenkul.se/" target="_blank" rel="noopener">
        <span class="primary-menu__icon">
          <svg class="icon vk-wiki-icon">
            <use xlink:href="/svg-icons/regular.svg#book" href="/svg-icons/regular.svg#book"></use>
          </svg>
        </span>
        <span class="primary-menu__text vk-wiki-text">Vuxenkul Wiki</span>
      </a>
    `;
    if (firstListItem && firstListItem.parentNode) {
      firstListItem.parentNode.insertBefore(wikiLi, firstListItem);
    } else {
      sidebar.prepend(wikiLi);
    }
  }

  init();
})();
