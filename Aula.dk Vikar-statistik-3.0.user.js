// ==UserScript==
// @name            Aula.dk Vikar-statistik
// @namespace       https://github.com/MichaelRyom
// @description     Implements a menu option on aula.dk where substitute (vikar) lesson statistics per child for current school year.. The menu takes some time to load, dependten on data and number of children. - Opretter et ekstra menu punkt på aula.dk hvor vikar forbrug kan ses per barn for det nuværrende skole år.
// @version         3.0
// @author          Michael Ryom
// @match        https://www.aula.dk/*
// @grant        none
// ==/UserScript==

(async function () {
    'use strict';

    /**********************************************************
     * Helpers
     **********************************************************/

    function waitForElement(selector, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    reject();
                }
            }, 300);
        });
    }

    function formatLocal(date, time) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d} ${time}`;
    }

    function getCsrfToken() {
        return document.cookie
            .split('; ')
            .find(c => c.startsWith('Csrfp-Token='))
            ?.split('=')[1];
    }

    /**********************************************************
     * UI
     **********************************************************/

    function showOverlay(results) {
        let overlay = document.getElementById('aula-sub-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'aula-sub-overlay';
            overlay.style = `
                position: fixed;
                top: 80px;
                right: 40px;
                width: 640px;
                max-height: 70vh;
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.25);
                z-index: 9999;
                padding: 16px;
                overflow: auto;
                font-family: system-ui;
            `;
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <strong>Vikar-statistik (skoleår)</strong>
                <button id="aula-sub-close">✕</button>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                    <tr>
                        <th style="text-align:left">Barn</th>
                        <th>Måned</th>
                        <th>Lektioner</th>
                        <th>Vikar</th>
                        <th>%</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(r => `
                        <tr>
                            <td>${r.Child}</td>
                            <td>${r.Year}-${String(r.Month).padStart(2,'0')}</td>
                            <td style="text-align:center">${r.Lessons}</td>
                            <td style="text-align:center">${r.SubstituteLessons}</td>
                            <td style="text-align:center">${r.SubstitutePct}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('aula-sub-close').onclick = () => overlay.remove();
    }

    async function addMenuItem(onClick) {
        const moreMenu = await waitForElement('#more-menu');

        if (document.getElementById('aula-sub-menu')) return;

        const a = document.createElement('a');
        a.id = 'aula-sub-menu';
        a.className = 'menu-link';
        a.tabIndex = 0;
        a.setAttribute('aria-label', 'Vikar-statistik');

        a.innerHTML = `
            <div class="menu-item" aria-hidden="true">
                <div class="position-relative">
                    <i class="menu-icon icon-Aula_calendar"></i>
                </div>
                <div class="menu-text text-truncate">
                    Vikar-statistik
                </div>
            </div>
        `;

        a.addEventListener('click', onClick);
        moreMenu.parentElement.insertBefore(a, moreMenu);
    }

    /**********************************************************
     * Core logic (PowerShell-equivalent)
     **********************************************************/

    async function runSubstituteStats() {
        const csrfToken = getCsrfToken();
        if (!csrfToken) {
            alert('CSRF token not found – are you logged in?');
            return [];
        }

        // --- school year start (last August) ---
        const now = new Date();
        const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
        const schoolYearStart = new Date(startYear, 7, 1);

        // --- fetch profile context ---
        const profileRes = await fetch(
            'https://www.aula.dk/api/v22/?method=profiles.getProfileContext',
            {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Csrfp-Token': csrfToken
                }
            }
        );

        const profileJson = await profileRes.json();

        const children =
            profileJson?.data?.institutionProfile?.relations
                ?.filter(r => r.role === 'child') || [];

        if (!children.length) {
            alert('No children found');
            return [];
        }

        const results = [];

        for (const child of children) {
            let date = new Date(schoolYearStart);

            while (
                date.getFullYear() < now.getFullYear() ||
                (date.getFullYear() === now.getFullYear() &&
                 date.getMonth() <= now.getMonth())
            ) {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;

                const firstDay = new Date(year, date.getMonth(), 1);
                const lastDay = new Date(year, date.getMonth() + 1, 0);

                const start = formatLocal(firstDay, '00:00:00.0000');
                const end   = formatLocal(lastDay,  '23:59:59.9990');

                const res = await fetch(
                    'https://www.aula.dk/api/v22/?method=calendar.getEventsByProfileIdsAndResourceIds',
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Csrfp-Token': csrfToken
                        },
                        body: JSON.stringify({
                            instProfileIds: [child.id],
                            resourceIds: [],
                            start,
                            end
                        })
                    }
                );

                const json = await res.json();
                const events = Object.values(json.data || {});

                // EXACT PowerShell behavior:
                const lessons = events.filter(
                    e => e.lesson && typeof e.lesson.lessonStatus === 'string'
                );

                const substituteLessons = lessons.filter(
                    e => e.lesson.lessonStatus.includes('substitute')
                ).length;

                const total = lessons.length;
                const pct = total
                    ? Math.round((substituteLessons / total) * 10000) / 100
                    : 0;

                results.push({
                    Child: child.fullName,
                    Class: child.mainGroupName,
                    Year: year,
                    Month: month,
                    Lessons: total,
                    SubstituteLessons: substituteLessons,
                    SubstitutePct: pct
                });

                date.setMonth(date.getMonth() + 1);
            }
        }

        return results;
    }

    /**********************************************************
     * Bootstrapping
     **********************************************************/

    async function init() {
        await addMenuItem(async () => {
            const results = await runSubstituteStats();
            showOverlay(results);
        });
    }

    init();

    // Re-inject after SPA navigation
    setInterval(init, 3000);

})();
