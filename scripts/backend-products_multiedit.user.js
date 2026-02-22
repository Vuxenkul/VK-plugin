// ==UserScript==
// @name         Admin hantera produkter – Kopiera (Art.nr, Namn, Antal, Edit-länk, Webb-länk)
// @namespace    https://vuxenkul.se/
// @version      1.0
// @description  Kopiera/Ladda ner produkter, välj om variant (.product-list-same) ska tas med
// @match        https://vuxenkul.se/butikadmin/products_multiedit.php*
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @updateURL    https://wiki.vuxenkul.se/public/tampermonkey/backend-products_multiedit.user.js
// @downloadURL  https://wiki.vuxenkul.se/public/tampermonkey/backend-products_multiedit.user.js
// ==/UserScript==

(function () {
  'use strict';

  const table = document.querySelector('.product-list-table');
  if (!table) return;

  /* ── 1. Stilar ───────────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    .vk-export-btn{
      background:#ff2471!important;
      border:none!important;border-radius:5px!important;
      color:#fff!important;padding:11px!important;
      margin:1rem 0!important;cursor:pointer;font-weight:600;
    }
    .vk-export-btn:hover{background:#e11963!important;}
    .vk-export-box{display:flex;gap:.5rem;align-items:center;max-width: fit-content;}
    .vk-export-box label{font-size:.875rem;user-select:none;color:#444;}
  `;
  document.head.appendChild(style);

  /* ── 2. UI: knappar + kryssruta ──────────────────────────────────────── */
  const copyBtn = makeBtn(), csvBtn = makeBtn();
  const includeCb = Object.assign(document.createElement('input'), {type:'checkbox', id:'vk-inc-same'});
  const includeLbl = Object.assign(document.createElement('label'), {htmlFor:'vk-inc-same', textContent:'Ta med variant­rader (product-list-same)'});

  const box = Object.assign(document.createElement('div'), {className:'vk-export-box'});
  box.append(copyBtn, csvBtn, includeCb, includeLbl);
  table.parentElement.insertBefore(box, table);

  refreshLabels();

  /* ── 3. Händelser ───────────────────────────────────────────────────── */
  document.addEventListener('change', e => {
    if (e.target.matches('.product-list-check, .product-list-check-all')) refreshLabels();
  });
  includeCb.addEventListener('change', refreshLabels);

  copyBtn.addEventListener('click', () => {
    const txt = toLines(selectedRows()).map(r=>r.join('\t')).join('\n');
    navigator.clipboard.writeText(txt).then(()=>flash(copyBtn,'Kopierat ✔'));
  });

  csvBtn.addEventListener('click', () => {
    const csv = toLines(selectedRows())
               .map(r=>r.map(v=>`"${v.replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const a = Object.assign(document.createElement('a'), {
      href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
      download:`produkter_${new Date().toISOString().slice(0,10)}.csv`
    });
    document.body.appendChild(a).click(); a.remove();
  });

  GM_registerMenuCommand('Kopiera produkter', () => copyBtn.click());
  GM_registerMenuCommand('Ladda ner CSV',     () => csvBtn.click());

  /* ── 4. Funktioner ──────────────────────────────────────────────────── */

  function makeBtn(){ const b=document.createElement('button'); b.className='vk-export-btn'; return b; }

  function selectedRows() {
    const rows = [...table.querySelectorAll('tbody tr')];
    const valid = r => includeCb.checked || !r.classList.contains('product-list-same');

    const checked = [...table.querySelectorAll('.product-list-check:checked')]
                      .map(cb=>cb.closest('tr')).filter(valid);
    return checked.length ? checked : rows.filter(valid);
  }

  function toLines(rows){
    const lines=[['Art.nr','Namn','Antal','Edit-länk','Webb-länk']];
    rows.forEach(r=>{
      const art=r.querySelector('td:nth-child(2)')?.innerText.trim()||'';
      const name=r.querySelector('.column-title a.table-list__title')?.textContent.trim()||'';
      const stock=(r.querySelector('.column-stock')?.innerText.match(/^\s*([\d\-,.]+)\s*st\./i)||[,''])[1];
      const id=r.dataset.pid||'';
      const edit=id?`https://vuxenkul.se/butikadmin/products.php?action=edit&id=${id}`:'';
      const view=r.querySelector('a[title="Visa"]')?.href||'';
      if(art&&name) lines.push([art,name,stock,edit,view]);
    });
    return lines;
  }

  function refreshLabels(){
    const anySel = table.querySelector('.product-list-check:checked') && selectedRows().length;
    copyBtn.textContent = anySel ? 'Kopiera markerade produkter' : 'Kopiera alla produkter';
    csvBtn.textContent  = anySel ? 'Ladda ner markerade (CSV)'   : 'Ladda ner alla (CSV)';
  }

  function flash(btn,msg){const o=btn.textContent;btn.textContent=msg;setTimeout(()=>btn.textContent=o,2000);}
})();
