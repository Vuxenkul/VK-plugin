// ==UserScript==
// @name         Backend Hantera Produkter – Zoombara bilder i listor och hantera produkter.
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Zoombara bilder i listor och hantera produkter. Lägger även till bilder under filter för lättare översikt
// @author       You
// @match        https://vuxenkul.se/butikadmin/products.php*
// @match        https://vuxenkul.se/butikadmin/products_multiedit.php*
// @updateURL    https://wiki.vuxenkul.se/public/tampermonkey/backend-images.user.js
// @downloadURL  https://wiki.vuxenkul.se/public/tampermonkey/backend-images.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // --- Config: set to false if you DON'T want the extra gallery under the filters ---
  const ADD_EXTRA_GALLERY_UNDER_FILTERS = true;

  // Shared state for the lightbox
  let overlay, overlayImg, btnPrev, btnNext;
  let openUrls = [];
  let currentIndex = -1;

  window.addEventListener('load', () => {
    const path = location.pathname || '';
    if (path.endsWith('/products.php')) {
      initProductsPage();
    } else if (path.endsWith('/products_multiedit.php')) {
      initMultiEditPage();
    }
  });

  // ---------- Shared lightbox ----------
  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.75)',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      zIndex: '10000', cursor: 'zoom-out'
    });

    overlayImg = document.createElement('img');
    Object.assign(overlayImg.style, {
      maxWidth: '85vw', maxHeight: '85vh',
      boxShadow: '0 0 45px rgba(0,0,0,.46)', background: 'white', cursor: 'default'
    });
    overlay.appendChild(overlayImg);

    btnPrev = document.createElement('button');
    btnNext = document.createElement('button');
    btnPrev.textContent = '❮'; btnNext.textContent = '❯';
    [btnPrev, btnNext].forEach(btn => {
      Object.assign(btn.style, {
        position: 'fixed', top: '50%', transform: 'translateY(-50%)',
        background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
        padding: '15px', fontSize: '24px', cursor: 'pointer', zIndex: '10001', display: 'none'
      });
    });
    btnPrev.style.left = '20px';
    btnNext.style.right = '20px';

    btnPrev.addEventListener('click', (e) => { e.stopPropagation(); navigate(-1); });
    btnNext.addEventListener('click', (e) => { e.stopPropagation(); navigate(1); });

    overlay.addEventListener('click', closeLightbox);
    overlayImg.addEventListener('click', (e) => e.stopPropagation());

    document.body.appendChild(overlay);
    document.body.appendChild(btnPrev);
    document.body.appendChild(btnNext);

    document.addEventListener('keydown', (e) => {
      if (overlay.style.display !== 'flex') return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });
  }

  function openLightbox(urls, index) {
    ensureOverlay();
    openUrls = urls || [];
    if (!openUrls.length) return;
    currentIndex = index;
    overlayImg.src = openUrls[currentIndex];
    overlay.style.display = 'flex';
    const showNav = openUrls.length > 1;
    btnPrev.style.display = showNav ? 'block' : 'none';
    btnNext.style.display = showNav ? 'block' : 'none';
  }

  function closeLightbox() {
    if (!overlay) return;
    overlay.style.display = 'none';
    currentIndex = -1;
    openUrls = [];
    btnPrev.style.display = 'none';
    btnNext.style.display = 'none';
  }

  function navigate(dir) {
    if (currentIndex < 0 || !openUrls.length) return;
    const len = openUrls.length;
    currentIndex = (currentIndex + dir + len) % len;
    overlayImg.src = openUrls[currentIndex];
  }

  // ---------- products.php ----------
  function initProductsPage() {
    const previewDiv = document.getElementById('imagepreviews');
    const filterListDiv = document.getElementById('checked-filters-list');
    if (!previewDiv) return;

    // (A) Enhance EXISTING previews in #imagepreviews:
    //     - Do NOT change their src (still /mini/)
    //     - On click, open the /normal/ version in the lightbox
    const previewImgs = Array.from(previewDiv.querySelectorAll('img'));
    if (previewImgs.length) {
      const previewUrls = previewImgs.map(img => {
        const raw = img.getAttribute('data-src') || img.src || '';
        return raw.replace('/mini/', '/normal/');
      });
      previewImgs.forEach((img, idx) => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openLightbox(previewUrls, idx);
        }, { passive: false });
      });
    }

    // (B) Optional: also add the extra gallery under the filter list (uses /normal/ thumbs)
    if (ADD_EXTRA_GALLERY_UNDER_FILTERS && filterListDiv && previewImgs.length) {
      const container = document.createElement('div');
      container.id = 'custom-image-container';
      Object.assign(container.style, {
        display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px'
      });

      const urls = previewImgs.map(img => {
        const raw = img.getAttribute('data-src') || img.src || '';
        return raw.replace('/mini/', '/normal/');
      });

      previewImgs.forEach((_, i) => {
        const thumb = document.createElement('img');
        thumb.src = urls[i]; // show /normal/ as 100px wide thumb
        Object.assign(thumb.style, {
          width: '100px', height: 'auto', cursor: 'pointer', objectFit: 'contain'
        });
        thumb.addEventListener('click', (e) => {
          e.stopPropagation();
          openLightbox(urls, i);
        });
        container.appendChild(thumb);
      });

      filterListDiv.parentNode.insertBefore(container, filterListDiv.nextSibling);
    }
  }

  // ---------- products_multiedit.php ----------
  function initMultiEditPage() {
    const table = document.querySelector('.product-list-table');
    if (!table) return;

    const thumbs = Array.from(table.querySelectorAll('img'));
    if (!thumbs.length) return;

    const normalUrls = thumbs.map(img => {
      const raw = img.getAttribute('data-src') || img.src || '';
      return raw.replace('/mini/', '/normal/');
    });

    thumbs.forEach((img, idx) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', (e) => {
        e.preventDefault(); // cancel the parent <a href="products.php?...">
        e.stopPropagation();
        openLightbox(normalUrls, idx);
      }, { passive: false });
    });
  }
})();
