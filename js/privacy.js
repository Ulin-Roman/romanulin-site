(() => {
    'use strict';
    if (window.romanPrivacy) return;
    const key = 'romanulin.analytics.v1';
    const maxAge = 365 * 24 * 60 * 60 * 1000;
    const root = new URL('../', document.currentScript.src);
    const privacyUrl = new URL('privacy/', root);
    if (location.protocol === 'file:') privacyUrl.pathname += 'index.html';
    let started = false;
    let banner;
    let returnFocus;
    function readChoice() {
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            return saved && saved.version === 1 && ['accepted', 'rejected'].includes(saved.choice)
                && Date.now() - saved.time >= 0 && Date.now() - saved.time < maxAge ? saved.choice : null;
        } catch { return null; }
    }
    function startAnalytics() {
        if (started) return;
        started = true;
        window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
        window.ym.l = Date.now();
        window.ym(112277728, 'init', {
            clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true
        });
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://mc.yandex.ru/metrika/tag.js';
        document.head.append(script);
    }
    function clearAnalyticsStorage() {
        try {
            Object.keys(localStorage).filter(name => name.startsWith('_ym')).forEach(name => localStorage.removeItem(name));
            const domains = location.hostname.split('.').map((_, i, parts) => parts.slice(i).join('.'));
            const paths = location.pathname.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/') || '/');
            document.cookie.split(';').forEach(cookie => {
                const name = cookie.split('=')[0].trim();
                if (!name.startsWith('_ym')) return;
                paths.forEach(path => {
                    document.cookie = `${name}=; Max-Age=0; Path=${path}`;
                    domains.forEach(domain => { document.cookie = `${name}=; Max-Age=0; Path=${path}; Domain=${domain}`; });
                });
            });
        } catch { /* Storage may be unavailable in private or local previews. */ }
    }
    function choose(choice) {
        try { localStorage.setItem(key, JSON.stringify({ version: 1, choice, time: Date.now() })); } catch { /* Keep this page usable without storage. */ }
        banner.hidden = true;
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        else document.querySelector('.brand-header')?.focus({ preventScroll: true });
        if (choice === 'accepted') startAnalytics();
        else {
            clearAnalyticsStorage();
            // A fresh document stops an already running tag, including Webvisor.
            if (started) location.reload();
        }
    }
    function showSettings() {
        returnFocus = document.activeElement;
        banner.hidden = false;
        banner.focus({ preventScroll: true });
    }
    window.romanPrivacy = { showSettings };
    banner = document.createElement('section');
    banner.className = 'cookie-notice container';
    banner.tabIndex = -1;
    banner.setAttribute('aria-label', 'Выбор использования аналитики');
    banner.innerHTML = `<div class="cookie-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><defs><mask id="cookie-bite-mask"><rect width="48" height="48" fill="white"/><circle cx="42" cy="8" r="8" fill="black"/><circle cx="44" cy="22" r="6" fill="black"/></mask></defs><circle cx="24" cy="24" r="19" fill="currentColor" mask="url(#cookie-bite-mask)"/><circle cx="17" cy="17" r="2.4"/><circle cx="29" cy="15" r="2"/><circle cx="19" cy="29" r="2"/><circle cx="31" cy="31" r="2.6"/></svg></div><div class="cookie-copy"><strong>Файлы cookie и аналитика</strong><p>Я использую cookie и Яндекс.Метрику, чтобы понимать, как посетители пользуются сайтом, и улучшать его. Аналитика включается только с вашего согласия. <a href="${privacyUrl.href}">Подробнее</a></p>
        <details><summary>Согласие на аналитику</summary><p>Нажимая «Принять», я добровольно разрешаю Улину Роману Владимировичу (ИНН 402915050097, ulin.roman.work@gmail.com) обрабатывать с помощью Яндекс.Метрики на romanulin.ru мой IP-адрес, идентификаторы cookie, сведения о браузере, устройстве и ОС, источниках переходов, просмотренных страницах и действиях, включая записи Вебвизора. Цель — анализ посещаемости и улучшение сайта. Разрешаю автоматизированные сбор, запись, хранение, использование, передачу ООО «ЯНДЕКС» для аналитики, обезличивание и удаление этих данных. Согласие действует один год или до отзыва через «Настройки cookie» внизу сайта либо обращением по указанному e-mail. Отказ не ограничивает доступ к сайту. Это отдельное согласие на аналитику, а не принятие иных документов.</p></details></div>
        <div class="cookie-actions"><button type="button" data-cookie-choice="accepted">Принять</button><button type="button" data-cookie-choice="rejected">Отклонить</button></div>`;
    const choice = readChoice();
    banner.hidden = !!choice;
    document.querySelector('.site-header')?.after(banner);
    if (!banner.isConnected) document.body.prepend(banner);
    banner.querySelectorAll('[data-cookie-choice]').forEach(button => button.addEventListener('click', () => choose(button.dataset.cookieChoice)));
    document.querySelectorAll('[data-cookie-settings]').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', showSettings);
    });
    if (choice === 'accepted') startAnalytics();
    else clearAnalyticsStorage();
    window.addEventListener('storage', event => {
        if (event.key !== key && event.key !== null) return;
        const updated = readChoice();
        if (updated === 'accepted') { banner.hidden = true; startAnalytics(); }
        else {
            clearAnalyticsStorage();
            if (started) location.reload();
            else banner.hidden = updated === 'rejected';
        }
    });
})();
