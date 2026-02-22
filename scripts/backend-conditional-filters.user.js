// ==UserScript==
// @name         Backend Filter - Funktion med filtersök och filterregler
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Visar valda filter, varningar och en fast sökruta (med Exact-match). Fixar “20 cm”-krockarna och lägger till DVD/Porrfilm-logik.
// @match        https://vuxenkul.se/butikadmin/products.php*
// @grant        none
// @updateURL    https://wiki.vuxenkul.se/public/tampermonkey/backend-conditional-filters.user.js
// @downloadURL  https://wiki.vuxenkul.se/public/tampermonkey/backend-conditional-filters.user.js
// ==/UserScript==

(function () {
    'use strict';

    /* ---------- 0) Hjälp ---------- */
    const cleanCat = t => t.replace(/[🢂►→:]/g, '').trim();
    const getArtNo = () => (document.getElementById('article-number')?.value || '').trim().toUpperCase();
    const isDVD    = () => getArtNo().startsWith('DVD');

    /* ---------- 1) Regler ---------- */
    const REQUIRED_DEFAULT = ["Produkttyp*", "Material", "Färg", "Tillverkare"];
    const REQUIRED_DVD = [
        "Porrfilm (Bolag)","Porrfilm (Orientering & Identitet)","Porrfilm (Kroppstyper)",
        "Porrfilm (Åldrar)","Porrfilm (Aktiviteter)","Porrfilm (Etniciteter)","Porrfilm (Genre)"
    ];

    const CONDITIONAL = [
        { c:"Produkttyp (Kläder)",      r:"Stil & Könskodning", m:"Kläder måste tilldelas filter: Stil & Könskodning" },
        { c:"Produkttyp (Kläder)",      r:"Klädstorlek",        m:"Kläder måste tilldelas filter: Klädstorlek" },
        { c:"Produkttyp (Sexleksaker)", r:"Styrningsalternativ",m:"Sexleksaker måste tilldelas: Styrningsalternativ" },
        { c:"Produkttyp (Glidmedel)",   r:"Volym",              m:"Glidmedel och glidsprutor måste tilldelas: Volym" }
    ];

    const CROSS = [
        { t:["Vibrationer","Elektrisk stimulering","Roterande","Thrusting / Stötande","Tryckvågor / Lufttryck","Sugande","Pratar/stönar","Pulserande","Värmande","Produkten pratar","Interaktiv (AI)","Slickande / Fladdrande"], r:"Styrningsalternativ",      m:"Produkten saknar styrningsalternativ" },
        { t:["Med effekt"],           r:"Effekt och känsla",      m:"Om 'Glidmedel med effekt' är valt måste effekt anges." },
        { t:["Kondomer"],             r:"Diameter (Kondomer)",    m:"Om 'Kondomer' är valt måste 'Diameter (Kondomer)' anges." },
        { t:["Dildos"],               r:"Diameter (Sexleksaker)", m:"Om 'Dildos' är valt måste 'Diameter (Sexleksaker)' anges." },
        { t:["Dildos","Analdildo"],   r:"Längd",                  m:"Om 'Dildos' är valt måste 'Längd' anges." }
    ];

    /* ---------- 2) Sammanfattning ---------- */
    function buildSummary() {
        const infoRow = document.querySelector('.filters-all');
        if (!infoRow) return;

        document.getElementById('checked-filters-list')?.remove();

        const box = document.createElement('div');
        box.id = 'checked-filters-list';
        Object.assign(box.style,{marginTop:'10px',padding:'10px',border:'1px solid #ccc',
                                 background:'#f9f9f9',display:'inline-block',verticalAlign:'top',width:'70%'});
        box.innerHTML = '<strong>Valda filteralternativ:</strong>';

        const ul = document.createElement('ul');
        ul.style.listStyle='none'; ul.style.padding='0';

        const checked = document.querySelectorAll('input[name="filteritems[]"]:checked');
        const byCat   = {};              // {catKey:{disp, items[]}}
        const labelSet= new Set();

        checked.forEach(cb=>{
            const lab = document.querySelector(`label[for="${cb.id}"]`);
            const catRaw = cb.closest('.input-area')?.querySelector('.form__row__title')?.textContent||'';
            if(!lab||!catRaw) return;
            const key = cleanCat(catRaw);
            byCat[key] ??= {disp:catRaw.trim(),items:[]};
            byCat[key].items.push(lab.textContent.trim());
            labelSet.add(lab.textContent.trim());
        });

        /* --- regler --- */
        const warn = [];
        (isDVD()?REQUIRED_DVD:REQUIRED_DEFAULT).forEach(k=>{
            const wildcard = k.includes('*');
            const ok = wildcard
                ? Object.keys(byCat).some(cat=>new RegExp(`^${k.replace('*','.*')}$`,'i').test(cat))
                : byCat[k];
            if(!ok) warn.push(`🔴 Produkten saknar: ${k.replace('*','')}`);
        });
        CONDITIONAL.forEach(({c,r,m})=>{
            if(byCat[c]&&!byCat[r]) warn.push(`🟠 ${m}`);
        });
        CROSS.forEach(({t,r,m})=>{
            if(t.some(l=>labelSet.has(l))&&!byCat[r]) warn.push(`⚠️ ${m}`);
        });

        /* --- render --- */
        Object.values(byCat).forEach(({disp,items})=>{
            const li=document.createElement('li');
            li.textContent = `${disp}: ${items.join(', ')}`;
            ul.appendChild(li);
        });
        if(!ul.childElementCount){ box.style.display='none'; return; }
        box.appendChild(ul);
        if(warn.length){
            const w=document.createElement('div');
            w.style.color='red'; w.style.marginTop='10px'; w.innerHTML=warn.join('<br>');
            box.appendChild(w);
        }
        document.getElementById('tampermonkey-search-container')?.after(box);
    }

    /* ---------- 3) Sökbox ---------- */
    const searchBoxHTML = `
        <input type="text" id="tm-search" placeholder="🔍 Sök filter / kategori" style="width:80%;padding:8px;">
        <label style="margin-left:10px;"><input type="checkbox" id="tm-exact"> Exact Match</label>
        <div id="tm-results" style="border:1px solid #ccc;max-height:200px;overflow-y:auto;display:none;padding:5px;background:#fff;"></div>
    `;
    const searchWrap = document.createElement('div');
    searchWrap.id='tampermonkey-search-container';
    searchWrap.style.marginTop='10px';
    searchWrap.innerHTML = searchBoxHTML;
    document.querySelector('.filters-all')?.after(searchWrap);

    const qInput  = document.getElementById('tm-search');
    const qExact  = document.getElementById('tm-exact');
    const qResBox = document.getElementById('tm-results');

    qInput.addEventListener('input',()=>runSearch());
    qExact.addEventListener('change',()=>runSearch());

    function runSearch(){
        const term = qInput.value.trim().toLowerCase();
        const exact= qExact.checked;
        qResBox.innerHTML=''; qResBox.style.display=term?'block':'none';
        if(!term) return;

        document.querySelectorAll('.filters-all .input-area').forEach(area=>{
            const catTitleEl = area.querySelector('.form__row__title'); if(!catTitleEl) return;
            const catRaw = catTitleEl.textContent.trim();
            const catClean = cleanCat(catRaw).toLowerCase();
            const inDVDMode = isDVD();
            if(inDVDMode && !catClean.startsWith('porrfilm')) return;
            if(!inDVDMode && catClean.startsWith('porrfilm')) return;

            const catMatch = exact ? catClean===term : catClean.includes(term);

            area.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
                const labEl = area.querySelector(`label[for="${cb.id}"]`); if(!labEl) return;
                const labTxt = labEl.textContent.trim();
                const labLC  = labTxt.toLowerCase();
                const labelMatch = exact ? labLC===term : labLC.includes(term);

                if(catMatch || labelMatch){
                    appendResult(cb,catRaw,labTxt);
                }
            });
        });
    }

    function appendResult(cb,cat,lab){
        const row=document.createElement('div');
        row.style.cssText='padding:4px 0;font-size:14px;cursor:pointer;';
        row.innerHTML=`<input type="checkbox" ${cb.checked?'checked':''}> <strong>${cat}</strong> ${lab}`;
        const rowCB=row.firstElementChild;

        /* sync när original ändras */
        const sync=()=>{rowCB.checked=cb.checked;};
        sync(); cb.addEventListener('change',sync);

        /* klick -> toggle original */
        const toggle=()=>{ cb.checked=!cb.checked; cb.dispatchEvent(new Event('change',{bubbles:true})); };
        rowCB.addEventListener('change',e=>toggle());
        row.addEventListener('click',e=>{ if(e.target!==rowCB) toggle(); });

        qResBox.appendChild(row);
    }

    /* ---------- 4) Initialisering & events ---------- */
    buildSummary();
    document.addEventListener('change',e=>{
        if(e.target.matches('input[name="filteritems[]"]')) buildSummary();
    });
    document.getElementById('article-number')?.addEventListener('input',()=>{runSearch(); buildSummary();});

})();
