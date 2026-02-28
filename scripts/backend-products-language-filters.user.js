// ==UserScript==
// @name         Backend produkter – Språkfilter för kort- och långbeskrivning (SV/EN/ES)
// @description  Lägger till språkväxling i produktformuläret så att fält för kort/lång beskrivning kan filtreras per språk. Visar språkflaggor och gör det enklare att fokusera på rätt översättning.
// @version      1.0
// @match        https://vuxenkul.se/butikadmin/products.php*
// ==/UserScript==

(function () {
  'use strict';

  const flagMap = {
    sv: '//wgrremote.se/flags/svg/4x3/se.svg',
    en: '//wgrremote.se/flags/svg/4x3/gb.svg',
    es: '//wgrremote.se/flags/svg/4x3/es.svg'
  };

  function getLangFromName(name) {
    const match = name.match(/(?:shortDescription|description)[_-](\w{2})/);
    return match ? match[1] : null;
  }

  function processGroup(mainLabel) {
    const mainRow = mainLabel.closest('.form__row');
    if (!mainRow) return;

    const nestedRows = Array.from(mainRow.querySelectorAll(':scope > .form__row'));
    if (!nestedRows.length) return;

    nestedRows.forEach((row, index) => {
      const textarea = row.querySelector('textarea');
      if (!textarea) return;

      const lang = getLangFromName(textarea.name);
      const flagUrl = flagMap[lang];

      const flagContainer = row.querySelector('.input-group__text');
      if (flagContainer && flagUrl && !flagContainer.querySelector('img.language-icon')) {
        const img = document.createElement('img');
        img.className = 'language-icon';
        img.alt = lang;
        img.src = flagUrl;
        flagContainer.appendChild(img);
      }

      row.style.display = index === 0 ? '' : 'none';
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Visa alla språk';
    Object.assign(toggleBtn.style, {
      background: '#ff2471',
      color: 'white',
      border: 'unset',
      fontSize: '13px',
      fontWeight: '600',
      borderRadius: '10px',
      padding: '7px 17px',
      marginTop: '10px',
      cursor: 'pointer'
    });

    toggleBtn.addEventListener('click', () => {
      const hidden = nestedRows.slice(1).every((row) => row.style.display === 'none');
      nestedRows.forEach((row, index) => {
        if (index > 0) row.style.display = hidden ? '' : 'none';
      });
      toggleBtn.textContent = hidden ? 'Dölj andra språk' : 'Se andra språk';
    });

    nestedRows[nestedRows.length - 1].after(toggleBtn);
  }

  function setup() {
    const shortLabels = document.querySelectorAll('label[for^="shortDescription-"]');
    const descLabels = document.querySelectorAll('label[for^="description-"]');

    shortLabels.forEach((label) => processGroup(label));
    descLabels.forEach((label) => processGroup(label));
  }

  window.addEventListener('load', setup);
})();
