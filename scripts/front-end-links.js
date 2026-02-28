// ==UserScript==
// @name         Front-end - Länkar backend / Kopiera varor
// @version      1.3
// @match        https://vuxenkul.se/*
// @exclude      https://vuxenkul.se/
// @exclude      https://vuxenkul.se/butikadmin/*
// ==/UserScript==

(function () {
    'use strict';

    /* ═══════════ 1. Stil-konstanter ═══════════ */
    const pillStyle = `
        display:inline-block;
        margin:0 6px 5px 0;
        font-size:13px;
        padding:3px 8px;
        background:#ff4081;
        color:#fff;
        border-radius:3px;
        font-weight:bold;
        text-decoration:none;
        cursor:pointer;
    `;
    const headerBarStyle = `
        display:flex;
        flex-wrap:wrap;
        margin-bottom:10px;
        align-items:center;
    `;

    /* ═══════════ 1.1 Hjälpare: hämta bästa bild-URL och absolutisera ─═══════════ */
    function getProductImageUrl(item) {
        const img = item.querySelector('.product-item__img img');
        if (!img) return '';

        // Föredra data-srcset eller srcset (tar första kandidaten)
        const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
        if (srcset) {
            const first = srcset.split(',')[0].trim(); // första kandidaten
            const urlPart = first.split(/\s+/)[0];     // ta bort "2x" etc.
            try { return new URL(urlPart, location.origin).href; } catch { /* ignore */ }
        }

        // Fall back: data-src, sedan src
        const raw = img.getAttribute('data-src') || img.getAttribute('src') || '';
        if (!raw) return '';
        try { return new URL(raw, location.origin).href; } catch { return raw; }
    }

    /* ═══════════ 2. Toolbar ELLER Meta-info ═══════════ */
    function createHeaderButtonsOrMetaInfo() {
        const gallery = document.querySelector('.grid-gallery');
        const hasProducts = document.querySelector('.product-item.js-product-item');

        // Städa upp ev. felplacerade element så vi inte dubblar
        if (gallery && document.querySelector('#vk-meta-info')) {
            document.querySelector('#vk-meta-info')?.remove();
        }

        if (gallery) {
            // Endast lägg till toolbar om .grid-gallery finns
            if (document.querySelector('#vk-admin-toolbar')) return;
            if (!hasProducts) return; // inget att visa alls

            const bar = document.createElement('div');
            bar.id = 'vk-admin-toolbar';
            bar.style = headerBarStyle;

            // 📋 Kopiera-knappen
            const copyBtn = document.createElement('span');
            copyBtn.textContent = '📋 Kopiera URL (Endast synliga varor + bild)';
            copyBtn.style = pillStyle;
            copyBtn.addEventListener('click', copyVisibleProductURLs);
            bar.appendChild(copyBtn);

            // 👀 Visa alla-knappen
            const showAllBtn = document.createElement('span');
            showAllBtn.textContent = '👀 Visa alla varor';
            showAllBtn.style = pillStyle;
            showAllBtn.addEventListener('click', () => {
                const url = new URL(location.href);
                url.searchParams.set('page', '999');
                location.href = url.toString();
            });
            bar.appendChild(showAllBtn);

            // Placera precis ovanför .grid-gallery
            gallery.parentNode.insertBefore(bar, gallery);
        } else {
            // Om .grid-gallery inte finns: lägg INTE toolbar någonstans,
            // utan visa Metatitel + Meta description överst i <body>.
            if (document.querySelector('#vk-meta-info')) return;

            const metaTitle = document.title || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

            const metaBar = document.createElement('div');
            metaBar.id = 'vk-meta-info';
            metaBar.style = `
                background:#f5f5f5;
                padding:12px 14px;
                margin-bottom:15px;
                font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
                border:1px solid #ddd;
                line-height:1.4;
            `;

            const safe = (s) => s.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

            metaBar.innerHTML = `
                <div style="margin-bottom:6px;"><strong>Metatitel:</strong> ${safe(metaTitle)} <em>(${metaTitle.length} tecken)</em></div>
                <div><strong>Meta description:</strong> ${safe(metaDesc)} <em>(${metaDesc.length} tecken)</em></div>
            `;

            document.body.insertBefore(metaBar, document.body.firstChild);
            // Om en toolbar existerar av någon anledning, ta bort den (ska inte finnas utan gallery).
            document.querySelector('#vk-admin-toolbar')?.remove();
        }
    }

    /* ═══════════ 3. Kopiera med Art.nr, Namn, Bild, Front-end & Back-end ═══════════ */
    function copyVisibleProductURLs() {
        const rows = ['Art.nr\tNamn\tBild\tFront-end\tBack-end'];

        document.querySelectorAll('.product-item.js-product-item').forEach(item => {
            if (!item.offsetParent) return; // endast synliga

            const artNo     = item.getAttribute('data-artno')   || '';
            const name      = item.getAttribute('data-title')   || '';
            const productId = item.getAttribute('data-productid') || '';
            const frontUrl  = item.querySelector('.product-item__img a')?.href || '';
            const backUrl   = productId ? `https://vuxenkul.se/butikadmin/products.php?action=edit&id=${productId}` : '';
            const imgUrl    = getProductImageUrl(item);

            rows.push(`${artNo}\t${name}\t${imgUrl}\t${frontUrl}\t${backUrl}`);
        });

        navigator.clipboard.writeText(rows.join('\n'))
            .then(() => alert(`Kopierade ${rows.length - 1} rader till urklipp!`))
            .catch(err => alert('Kunde inte kopiera: ' + err));
    }

    /* ═══════════ 4. Edit-länkar på produkter ═══════════ */
    function addEditLinks(scope = document) {
        scope.querySelectorAll('.product-item.js-product-item').forEach(product => {
            const productId = product.getAttribute('data-productid');
            const artNo     = product.getAttribute('data-artno');
            const titleEl   = product.querySelector('h3.product-item__heading');

            if (!productId || !artNo || !titleEl) return;
            if (titleEl.previousElementSibling?.classList.contains('admin-edit-link')) return;

            const link = document.createElement('a');
            link.href   = `https://vuxenkul.se/butikadmin/products.php?action=edit&id=${productId}`;
            link.textContent = `✏️ Redigera (${artNo})`;
            link.target = '_blank';
            link.className = 'admin-edit-link';
            link.style = pillStyle;
            link.addEventListener('click', e => {
                e.stopPropagation(); e.preventDefault();
                window.open(link.href, '_blank');
            });

            titleEl.parentNode.insertBefore(link, titleEl);
        });
    }

    /* ═══════════ 5. Edit-länk för kategori ═══════════ */
    function addCategoryEditLink() {
        const match = document.body.className.match(/view-category-(\d+)/);
        if (!match) return;
        const catId = match[1];

        const h1 = document.querySelector('h1.category-heading[itemprop="headline"]');
        if (!h1 || h1.nextElementSibling?.classList.contains('admin-category-tools')) return;

        const tools = document.createElement('div');
        tools.className = 'admin-category-tools';
        tools.style = 'display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px;';

        const editLink = document.createElement('a');
        editLink.href   = `https://vuxenkul.se/butikadmin/categories.php?action=edit&id=${catId}`;
        editLink.textContent = `✏️ Redigera kategori (${catId})`;
        editLink.target = '_blank';
        editLink.className = 'admin-edit-category';
        editLink.style = pillStyle;
        tools.appendChild(editLink);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = '📋 Kopiera kategoritext';
        copyBtn.style = `${pillStyle};border:0;`;
        copyBtn.addEventListener('click', () => {
            const categoryHeading = document.querySelector('.category-heading')?.textContent?.trim() || '';
            const categoryLead = document.querySelector('.category-lead')?.textContent?.trim() || '';
            const categorySecondary = document.querySelector('.category-secondary')?.textContent?.trim() || '';

            const payload = [categoryHeading, categoryLead, categorySecondary].join('\n\n').trim();
            if (!payload) {
                alert('Hittade ingen kategoritext att kopiera.');
                return;
            }

            navigator.clipboard.writeText(payload)
                .then(() => {
                    const prev = copyBtn.textContent;
                    copyBtn.textContent = '✅ Kategoritext kopierad';
                    setTimeout(() => { copyBtn.textContent = prev; }, 1500);
                })
                .catch(err => alert('Kunde inte kopiera: ' + err));
        });
        tools.appendChild(copyBtn);

        h1.parentNode.insertBefore(tools, h1.nextSibling);
    }

    /* ═══════════ 6. Init & Observer ═══════════ */
    function initEverything() {
        createHeaderButtonsOrMetaInfo();
        addEditLinks();
        addCategoryEditLink();
    }

    window.addEventListener('load', initEverything);

    const observer = new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;

            const affectsUi = node.matches('.product-item.js-product-item, .grid-gallery, head meta[name="description"], title')
                || node.querySelector?.('.product-item.js-product-item, .grid-gallery, head meta[name="description"], title');

            if (affectsUi) {
                createHeaderButtonsOrMetaInfo(); // skapa/uppdatera toolbar eller meta-info beroende på läge
            }
            addEditLinks(node); // nya produkter får edit-länk
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
