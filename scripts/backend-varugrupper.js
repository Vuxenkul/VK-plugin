// ==UserScript==
// @name         Backend kategorier – Kategorisök, breadcrumb-kopiering och snabbgenvägar
// @description  Förbättrar sidan för varugrupper/kategorier med sökfält, träfflista, kopiering av kategorier som TSV med breadcrumb, samt knappar för att snabbt öppna edit- och visningslänkar.
// @version      1.0
// @match        https://vuxenkul.se/butikadmin/categories.php
// ==/UserScript==

(function () {
  'use strict';

  /*───────────────────────── Minimal CSS ─────────────────────────*/
  const css = `
    .cat-search__bar{display:flex;align-items:center;gap:12px;margin-bottom:8px;font-family:sans-serif}
    .cat-search__wrap{position:relative}
    .cat-search__label{font-size:13px;color:#374151}
    .cat-search__input{width:220px;padding:6px 10px;font-size:13px;border:3px solid #ff2471;border-radius:25px;outline:none;transition:width .2s,box-shadow .2s}
    .cat-search__input:focus{width:280px;box-shadow:0 0 0 2px rgba(59,130,246,.4)}
    .cat-search__results{display:none;position:absolute;top:115%;left:0;width:100%;max-height:240px;margin-top:4px;padding:4px 0;background:#fff;border:1px solid #e5e7eb;border-radius:6px;box-shadow:0 4px 8px rgba(0,0,0,.1);z-index:10000;overflow-y:auto;min-width:fit-content}
    .cat-search__results li{padding:8px 12px;font-size:14px;color:#111827;white-space:nowrap;cursor:pointer}
    .cat-search__results li+li{border-top:1px solid #f3f4f6}
    .cat-search__results li:hover{background:#f9fafb}
    .cat-search__results strong{font-weight:600;color:#1f2937}
    .cat-btn{background:#ff2471;color:#fff;border:0;border-radius:6px;padding:6px 14px;font-size:13px;cursor:pointer}
    .cat-btn:hover{filter:brightness(1.08)}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /*───────────────────────── Utilities ─────────────────────────*/
  const waitFor = sel => new Promise(res=>{
    const n=document.querySelector(sel);
    if(n) return res(n);
    const ob=new MutationObserver(()=>{const el=document.querySelector(sel);if(el){ob.disconnect();res(el)}});
    ob.observe(document.documentElement,{childList:true,subtree:true});
  });
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  /*───────────────────────── Category search + TSV copy ─────────────────────────*/
  async function initCategoryTools(){
    const table = await waitFor('table.table-list');
    if(document.querySelector('.cat-search__bar')) return;

    // Extract items with breadcrumb; mark dynamic "(Dyn)"
    const rows = [...table.tBodies[0].rows];
    const items=[];
    const stack=[];
    rows.forEach(row=>{
      const titleA=row.querySelector('.table-list__title');
      if(!titleA) return;

      // depth from padding-left (inline style contains rem)
      const pad=(titleA.closest('td').style.paddingLeft||'0').trim();
      const remMatch=pad.match(/([\d.]+)rem/);
      const rem = remMatch ? parseFloat(remMatch[1]) : 0;
      const level = Math.max(0, Math.round(rem - 1)); // 1rem -> level 0

      // dynamic?
      const isDyn = !!row.querySelector('.table-list__dynamic,[title="Dynamisk kategori"]');

      // maintain stack
      const name = titleA.textContent.trim() + (isDyn ? ' (Dyn)' : '');
      stack[level]=name;
      stack.length=level+1;

      const breadcrumb = stack.join(' › ');
      const editHref = row.querySelector('.table-list__tools a[href*="action=edit"]')?.href || titleA.href;
      const viewHref = row.querySelector('.table-list__tools a[target="_blank"]')?.href || '';

      items.push({ breadcrumb, editHref, viewHref });
    });

    // Controls block (before original table)
    const bar=document.createElement('div');
    bar.className='cat-search__bar';
    bar.innerHTML=`
      <span class="cat-search__label">Sök kategori:</span>
      <div class="cat-search__wrap">
        <input class="cat-search__input" type="search" placeholder="Sök kategori…" aria-label="Sök kategori">
        <ul class="cat-search__results" role="listbox"></ul>
      </div>
      <button type="button" class="cat-btn cat-export__copy">Kopiera (TSV)</button>
    `;
    table.parentElement.insertBefore(bar, table);

    // Search (navigate on click to edit link)
    const input=bar.querySelector('.cat-search__input');
    const list=bar.querySelector('.cat-search__results');
    let timer;
    input.addEventListener('input',()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const q=input.value.trim();
        if(!q){list.style.display='none';return;}
        const re=new RegExp(`(${escapeRe(q)})`,'gi');
        const hits=items.filter(i=>i.breadcrumb.toLowerCase().includes(q.toLowerCase()));
        if(!hits.length){list.style.display='none';return;}
        list.innerHTML=hits
          .map(i=>`<li data-href="${i.editHref}">${i.breadcrumb.replace(re,'<strong>$1</strong>')}</li>`)
          .join('');
        list.querySelectorAll('li').forEach(li=>li.onclick=()=>location.href=li.dataset.href);
        list.style.display='block';
      },120);
    });

    // Copy as TSV (for pasting directly into a table/spreadsheet)
    const copyBtn=bar.querySelector('.cat-export__copy');
    function buildTSV(data){
      const header=['Varugrupp','Back-end','Front-end'].join('\t');
      const rows = data.map(i=>[
        i.breadcrumb,
        i.editHref || '',
        i.viewHref || ''
      ].map(v=>v.replace(/\s+/g,' ').trim()).join('\t'));
      return header + '\n' + rows.join('\n');
    }
    copyBtn.addEventListener('click',()=>{
      const tsv = buildTSV(items);
      navigator.clipboard.writeText(tsv).then(()=>{
        const prev=copyBtn.textContent;
        copyBtn.textContent='Kopierat (TSV)';
        setTimeout(()=>copyBtn.textContent=prev,1500);
      }).catch(()=>{
        alert('Kunde inte kopiera till urklipp.');
      });
    });

    // Apply UI enhancements once table exists
    enhanceCategoryHierarchy();

    // Re-apply on dynamic changes (pagination, filters, etc.)
    const tb = table.tBodies[0];
    const mo = new MutationObserver(() => enhanceCategoryHierarchy());
    mo.observe(tb, { childList: true, subtree: true });
  }

  /*───────────────────────── UI Enhancements for hierarchy ─────────────────────*/
  function enhanceCategoryHierarchy() {
    // Color-coded left borders by depth + bold for top level
    document.querySelectorAll('.table-list tbody tr td:first-child').forEach((td) => {
      const titleLink = td.querySelector('.table-list__title');
      if (!titleLink) return;

      // Determine depth from inline padding-left on the <td>
      const paddingMatch = td.getAttribute('style')?.match(/padding-left:\s*([\d.]+)rem/);
      const paddingRem = paddingMatch ? parseFloat(paddingMatch[1]) : 0;

      let borderColor;
      if (paddingRem === 1) {
        borderColor = '#FF2471'; // Level 1 (röd/rosa)
        titleLink.style.fontWeight = '700';
      } else if (paddingRem === 2) {
        borderColor = '#27B5C8'; // Level 2 (cyan)
      } else if (paddingRem === 3) {
        borderColor = '#FFBE00'; // Level 3 (gul)
      } else {
        borderColor = '#333333'; // Djupare nivåer (mörkgrå)
      }

      titleLink.style.paddingLeft = '5px';
      titleLink.style.borderLeft = `8px solid ${borderColor}`;
    });

    // Normalize status column font size
    document.querySelectorAll('.table-list__status').forEach((statusCell) => {
      statusCell.style.fontSize = '1rem';
    });
  }

  // Kick things off
  initCategoryTools();

})();
