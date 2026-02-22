// ==UserScript==
// @name         Backend Produkter - UI förbättringar för produktsidan med kollapsade filterboxar
// @version      1.0
// @match        https://vuxenkul.se/butikadmin/products.php*
// ==/UserScript==

(function () {
    'use strict';

    enhanceProductPage();

    /**************** PRODUKTER ****************/
    function enhanceProductPage() {
        injectCustomCSS();
        initIndividualFilterToggles();
        addMasterFilterToggle();
    }

    /* --- CSS --- */
    function injectCustomCSS() {
        const css = `
            /* Layoutfliken för varje enskilt filter */
            .filter-selector {
                column-count: 3;
                height: auto !important;
                font-size: 15px;
                overflow: visible !important;
            }
            /* Rubriker */
            .form__row__title {
                font-weight: 900;
                border-left: 10px solid #FF2471;
                font-size: 16px;
                padding-left: 4px;
            }
            /* Filterrubriker i filters-all */
            .filters-all .form__row__title {
                font-size: 15px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: 600;
                border-left: unset;
                padding-left: unset;
            }
            /* Rubriker inuti kort */
            .card .form__row__title {
                border-left: unset;
                font-weight: 600;
                font-size: 14px;
                padding-left: unset;
            }
            /* Flagggrafik */
            .language-icon {
                width: 27px;
            }
            /* Input-area i filter */
            .filters-all .input-area {
                display: block !important;
                width: 100% !important;
                margin-right: 0 !important;
                max-height: unset !important;
            }
            /* Pilar */
            .toggle-arrow {
                font-size: 18px;
                display: inline-block;
                transition: transform 0.3s ease-in-out;
            }
            /* ===== NYTT: master-toggle för alla filter ===== */
            .filters-wrapper {
                margin-bottom: 1rem;
            }
            .filters-master-title {
                font-weight: 700;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                border-left: 10px solid #333;
                padding-left: 4px;
                margin-bottom: 4px;
            }
        `;

        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* --- Individuella filter (befintlig funktion) --- */
    function initIndividualFilterToggles() {
        /* Dölj alla filterinnehåll från start */
        document.querySelectorAll('.filters-all .filter-selector').forEach((sel) => {
            sel.style.display = 'none';
        });

        /* Lägg till pil & klicklyssnare */
        document.querySelectorAll('.filters-all .form__row__title').forEach((title) => {
            const arrow = document.createElement('span');
            arrow.className = 'toggle-arrow';
            arrow.textContent = '🢂';
            title.appendChild(arrow);

            title.addEventListener('click', () => {
                const next = title.nextElementSibling;
                if (next && next.classList.contains('filter-selector')) {
                    const hidden = next.style.display === 'none';
                    next.style.display = hidden ? 'block' : 'none';
                    arrow.style.transform = hidden ? 'rotate(90deg)' : 'rotate(0deg)';
                }
            });
        });
    }

    /* --- NY FUNKTION: huvudknapp för hela filtersektionen --- */
    function addMasterFilterToggle() {
        const filtersContainer = document.querySelector('.filters-all');
        if (!filtersContainer) return; // Säkerhetskoll

        /* Skapa wrapper + rubrik */
        const wrapper = document.createElement('div');
        wrapper.className = 'filters-wrapper';

        const masterTitle = document.createElement('div');
        masterTitle.className = 'filters-master-title';

        const arrow = document.createElement('span');
        arrow.className = 'toggle-arrow';
        arrow.textContent = '🢂';
        masterTitle.appendChild(arrow);
        masterTitle.append(' Filtrera produkter');

        /* Lägg wrapper före filtercontainern & flytta in den */
        filtersContainer.parentNode.insertBefore(wrapper, filtersContainer);
        wrapper.appendChild(masterTitle);
        wrapper.appendChild(filtersContainer);

        /* Dölj alla filter vid start */
        filtersContainer.style.display = 'none';

        /* Klick för show/hide */
        masterTitle.addEventListener('click', () => {
            const hidden = filtersContainer.style.display === 'none';
            filtersContainer.style.display = hidden ? 'block' : 'none';
            arrow.style.transform = hidden ? 'rotate(90deg)' : 'rotate(0deg)';
        });
    }

})();
