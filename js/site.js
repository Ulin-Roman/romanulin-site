// Normalize legacy web addresses while retaining query parameters and anchors.
if (/^https?:$/.test(window.location.protocol) && window.location.pathname.endsWith('/index.html')) {
    const cleanAddress = new URL(window.location.href);
    cleanAddress.pathname = cleanAddress.pathname.slice(0, -'index.html'.length);
    window.history.replaceState(window.history.state, '', cleanAddress.href);
}

// Directory URLs need an explicit file name when previewing files locally.
if (window.location.protocol === 'file:') {
    document.addEventListener('click', (event) => {
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!link || link.getAttribute('href').startsWith('#')) return;
        const localAddress = new URL(link.href);
        if (localAddress.protocol === 'file:' && localAddress.pathname.endsWith('/')) {
            localAddress.pathname += 'index.html';
            link.href = localAddress.href;
        }
    }, true);
}

const blogScrollPositionKey = 'romanulin-blog-scroll-position';
const blogScrollRestoreKey = 'romanulin-blog-scroll-restore';
const blogIndexGrid = document.querySelector('.blog-index-grid');
let incomingBlogScrollPosition = null;

try {
    const rawScrollParameter = new URL(window.location.href).searchParams.get('feedScroll')
        ?? window.history.state?.feedScroll ?? null;
    const scrollParameter = Number(rawScrollParameter);
    if (rawScrollParameter !== null && Number.isFinite(scrollParameter) && scrollParameter >= 0) {
        incomingBlogScrollPosition = scrollParameter;
    }
} catch (error) {
    incomingBlogScrollPosition = null;
}

const readBlogScrollPosition = () => {
    try {
        const savedPosition = Number(window.sessionStorage.getItem(blogScrollPositionKey));
        return Number.isFinite(savedPosition) && savedPosition >= 0 ? savedPosition : 0;
    } catch (error) {
        return 0;
    }
};

const saveBlogScrollPosition = () => {
    try {
        window.sessionStorage.setItem(blogScrollPositionKey, String(Math.round(window.scrollY)));
    } catch (error) {
        // Browser storage can be unavailable for local previews.
    }
};

if (blogIndexGrid) {
    let isRestoringBlogPosition = incomingBlogScrollPosition !== null;

    try {
        isRestoringBlogPosition = incomingBlogScrollPosition !== null
            || window.sessionStorage.getItem(blogScrollRestoreKey) === 'true';
    } catch (error) {
        // The URL still carries the position when storage is unavailable.
    }

    const restorePosition = incomingBlogScrollPosition ?? readBlogScrollPosition();
    const restoreBlogScrollPosition = () => {
        if (!isRestoringBlogPosition) return;
        window.scrollTo({ top: restorePosition, left: 0, behavior: 'instant' });
    };

    if (isRestoringBlogPosition) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(restoreBlogScrollPosition));
        window.addEventListener('load', () => {
            restoreBlogScrollPosition();
            isRestoringBlogPosition = false;
            try {
                window.sessionStorage.removeItem(blogScrollRestoreKey);
            } catch (error) {
                // Browser storage can be unavailable for local previews.
            }
            try {
                const cleanAddress = new URL(window.location.href);
                cleanAddress.searchParams.delete('feedScroll');
                window.history.replaceState(window.history.state, '', cleanAddress.href);
            } catch (error) {
                // Keeping the temporary parameter does not affect navigation.
            }
        }, { once: true });
    } else {
        saveBlogScrollPosition();
    }

    let saveScrollTimer;
    window.addEventListener('scroll', () => {
        if (isRestoringBlogPosition || saveScrollTimer) return;
        saveScrollTimer = window.setTimeout(() => {
            saveScrollTimer = null;
            if (!isRestoringBlogPosition) saveBlogScrollPosition();
        }, 150);
    }, { passive: true });
    window.addEventListener('pagehide', () => {
        if (!isRestoringBlogPosition) saveBlogScrollPosition();
    });
    const rememberArticlePosition = (event) => {
        saveBlogScrollPosition();
        const articleLink = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!articleLink) return;

        try {
            const articleAddress = new URL(articleLink.href);
            articleAddress.searchParams.set('feedScroll', String(Math.round(window.scrollY)));
            articleLink.href = articleAddress.href;
        } catch (error) {
            // The storage fallback still preserves the position on regular web pages.
        }
    };
    blogIndexGrid.addEventListener('click', rememberArticlePosition);
    blogIndexGrid.addEventListener('auxclick', rememberArticlePosition);
}

// Retain the feed position through reloads and navigation between articles.
if (!blogIndexGrid && incomingBlogScrollPosition !== null) {
    window.history.replaceState({ ...window.history.state, feedScroll: incomingBlogScrollPosition }, '', window.location.href);
    document.addEventListener('click', (event) => {
        const link = event.target instanceof Element ? event.target.closest('.related-article') : null;
        if (!link) return;
        const address = new URL(link.href);
        address.searchParams.set('feedScroll', String(incomingBlogScrollPosition));
        link.href = address.href;
    });
}

// Return from an article to the saved position in the blog index.
document.querySelectorAll('.blog-article .article-back').forEach((backLink) => {
    backLink.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        try {
            window.sessionStorage.setItem(blogScrollRestoreKey, 'true');
        } catch (error) {
            // The URL parameter below also works in local previews.
        }

        try {
            const blogAddress = new URL(backLink.href);
            const savedPosition = incomingBlogScrollPosition ?? readBlogScrollPosition();
            blogAddress.searchParams.set('feedScroll', String(savedPosition));
            window.location.href = blogAddress.href;
        } catch (error) {
            window.location.href = backLink.href;
        }
    });
});

document.querySelectorAll('a, button, img').forEach((control) => {
    control.draggable = false;
});

document.addEventListener('dragstart', (event) => {
    if (event.target instanceof Element && event.target.closest('a, button, .case-modal')) {
        event.preventDefault();
    }
});

const heroStage = document.querySelector('.hero-stage');
const heroMain = document.querySelector('.hero-main');
const heroCopy = document.querySelector('.hero-copy');
const heroBenefits = document.querySelector('.hero-benefits');
const heroConsultButton = heroCopy?.querySelector('.hero-consult-button');
const mobileHeroLayout = window.matchMedia('(max-width: 680px)');

const syncHeroBenefitsPosition = () => {
    if (!heroStage || !heroMain || !heroCopy || !heroBenefits || !heroConsultButton) return;

    if (mobileHeroLayout.matches) {
        heroCopy.insertBefore(heroBenefits, heroConsultButton);
    } else {
        heroMain.insertAdjacentElement('afterend', heroBenefits);
    }
};

syncHeroBenefitsPosition();
mobileHeroLayout.addEventListener('change', syncHeroBenefitsPosition);

function initializeSnow(snowLayer) {
    if (snowLayer.childElementCount) return;
    const fragment = document.createDocumentFragment();
    const width = snowLayer.clientWidth;
    const height = snowLayer.clientHeight;
    const area = width * height;
    const flakeCount = Math.max(20, Math.min(46, Math.round(area / 10500)));

    snowLayer.style.setProperty('--snow-fall', `${Math.max(420, height + 40)}px`);
    snowLayer.style.setProperty('--snow-mid', `${Math.max(202, Math.round((height + 40) * .48))}px`);

    for (let index = 0; index < flakeCount; index += 1) {
        const flake = document.createElement('i');
        const depth = Math.random();
        const size = 1.2 + depth * 3.8;

        flake.style.setProperty('--snow-x', `${Math.random() * 100}%`);
        flake.style.setProperty('--snow-size', `${size.toFixed(1)}px`);
        flake.style.setProperty('--snow-duration', `${(7 + (1 - depth) * 12 + Math.random() * 6).toFixed(1)}s`);
        flake.style.setProperty('--snow-delay', `${(-Math.random() * 24).toFixed(1)}s`);
        const drift = 85 + Math.random() * 115;
        flake.style.setProperty('--snow-drift', `${drift.toFixed(0)}px`);
        flake.style.setProperty('--snow-mid-drift', `${(drift * (.36 + Math.random() * .16)).toFixed(0)}px`);
        flake.style.setProperty('--snow-opacity', `${(.28 + depth * .58).toFixed(2)}`);
        flake.style.setProperty('--snow-blur', `${((1 - depth) * 1.1).toFixed(1)}px`);
        fragment.append(flake);
    }

    snowLayer.replaceChildren(fragment);
}

const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');

if (siteNav && !siteNav.querySelector('a[href$="#blog"]')) {
    const homeLink = siteNav.querySelector('a');
    const homeHref = homeLink?.getAttribute('href') || './';
    const blogLink = document.createElement('a');

    blogLink.href = document.getElementById('blog')
        ? '#blog'
        : `${homeHref.split('#')[0]}#blog`;
    blogLink.textContent = 'Мой блог';
    siteNav.append(blogLink);
}

if (menuToggle && siteNav) {
    const menuLinks = [...siteNav.querySelectorAll('a')];
    menuLinks.forEach((link, index) => {
        link.style.setProperty('--menu-enter-delay', `${index * 65}ms`);
        link.style.setProperty('--menu-exit-delay', `${(menuLinks.length - 1 - index) * 65}ms`);
    });
    siteNav.style.setProperty('--menu-close-duration', `${240 + Math.max(0, menuLinks.length - 1) * 65}ms`);
    const headerRow = menuToggle.closest('.header-row');
    const messengers = headerRow?.querySelector('.header-messengers');
    const maxLink = messengers?.querySelector('a[href*="max.ru/"]');
    const syncMenuWidth = () => {
        if (!headerRow || !maxLink || window.innerWidth > 900) return;
        // The panel's right edge is the header's padding edge; its left
        // edge follows MAX, including when the header layout changes.
        const width = headerRow.getBoundingClientRect().left + headerRow.clientLeft
            + headerRow.clientWidth - maxLink.getBoundingClientRect().left;
        if (width > 0) siteNav.style.setProperty('--mobile-menu-width', `${width}px`);
    };
    if (headerRow && messengers && 'ResizeObserver' in window) {
        const menuSizeObserver = new ResizeObserver(syncMenuWidth);
        menuSizeObserver.observe(headerRow);
        menuSizeObserver.observe(messengers);
    }
    syncMenuWidth();
    const closeMenu = () => {
        siteNav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Открыть меню');
        document.body.classList.remove('menu-open');
    };

    menuToggle.addEventListener('click', () => {
        syncMenuWidth();
        const willOpen = !siteNav.classList.contains('open');
        siteNav.classList.toggle('open', willOpen);
        menuToggle.setAttribute('aria-expanded', String(willOpen));
        menuToggle.setAttribute('aria-label', willOpen ? 'Закрыть меню' : 'Открыть меню');
        document.body.classList.toggle('menu-open', willOpen);
    });

    siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

    document.addEventListener('pointerdown', (event) => {
        if (!siteNav.classList.contains('open')) return;

        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.site-nav, .menu-toggle')) return;
        closeMenu();
    });

    const closeMenuOnScroll = () => {
        if (siteNav.classList.contains('open')) closeMenu();
    };

    window.addEventListener('scroll', closeMenuOnScroll, { passive: true });
    window.addEventListener('wheel', closeMenuOnScroll, { passive: true });
    window.addEventListener('touchmove', closeMenuOnScroll, { passive: true });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', () => {
        syncMenuWidth();
        if (window.innerWidth > 900) closeMenu();
    });
}

const filterButtons = document.querySelectorAll('[data-filter]');
const caseCards = document.querySelectorAll('[data-category]');

filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const selectedFilter = button.dataset.filter;

        filterButtons.forEach((item) => item.classList.toggle('active', item === button));
        caseCards.forEach((card) => {
            const categories = card.dataset.category.split(' ');
            const shouldShow = selectedFilter === 'all' || categories.includes(selectedFilter);
            card.classList.toggle('is-hidden', !shouldShow);
        });
    });
});

const caseModal = document.querySelector('#case-modal');

if (caseModal && caseCards.length) {
    const modalTitle = caseModal.querySelector('#case-modal-title');
    const modalCategory = caseModal.querySelector('#case-modal-category');
    const modalImage = caseModal.querySelector('#case-modal-image');
    const modalCount = caseModal.querySelector('.case-modal-count');
    const closeButton = caseModal.querySelector('.case-modal-close');
    const previousButton = caseModal.querySelector('[data-case-prev]');
    const nextButton = caseModal.querySelector('[data-case-next]');
    const modalViewport = caseModal.querySelector('.case-modal-viewport');
    let activeCase = null;
    let lastFocusedElement = null;

    modalImage.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button === 0) event.preventDefault();
    });

    const visibleCases = () => Array.from(caseCards).filter((card) => !card.classList.contains('is-hidden'));

    const renderCase = (card) => {
        const cases = visibleCases();
        const currentIndex = cases.indexOf(card);
        const caseLink = card.querySelector('.case-media-link');
        const title = card.querySelector('h3')?.textContent.trim() || 'Результаты рекламной кампании';
        const category = card.querySelector('.case-body > span')?.textContent.trim() || 'Кейс';

        activeCase = card;
        modalTitle.textContent = title;
        modalCategory.textContent = category;
        modalImage.src = caseLink?.getAttribute('href') || '';
        modalImage.alt = `Статистика рекламной кампании: ${title}`;
        modalCount.textContent = `${currentIndex + 1} / ${cases.length}`;
        modalViewport.scrollTop = 0;
    };

    const openCase = (card) => {
        lastFocusedElement = document.activeElement;
        renderCase(card);
        caseModal.hidden = false;
        caseModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('case-modal-open');
        requestAnimationFrame(() => closeButton.focus());
    };

    const closeCase = () => {
        caseModal.hidden = true;
        caseModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('case-modal-open');
        modalImage.removeAttribute('src');
        activeCase = null;
        if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    };

    const moveCase = (direction) => {
        const cases = visibleCases();
        if (!cases.length || !activeCase) return;
        const currentIndex = cases.indexOf(activeCase);
        const nextIndex = (currentIndex + direction + cases.length) % cases.length;
        renderCase(cases[nextIndex]);
    };

    caseCards.forEach((card) => {
        const caseLink = card.querySelector('.case-media-link');
        if (!caseLink) return;
        caseLink.addEventListener('click', (event) => {
            event.preventDefault();
            openCase(card);
        });
    });

    caseModal.querySelectorAll('[data-case-close]').forEach((control) => control.addEventListener('click', closeCase));
    previousButton.addEventListener('click', () => moveCase(-1));
    nextButton.addEventListener('click', () => moveCase(1));

    document.addEventListener('keydown', (event) => {
        if (caseModal.hidden) return;

        if (event.key === 'Escape') closeCase();
        if (event.key === 'ArrowLeft') moveCase(-1);
        if (event.key === 'ArrowRight') moveCase(1);

        if (event.key === 'Tab') {
            const focusable = [closeButton, previousButton, nextButton];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
}

const serviceItems = document.querySelectorAll('.services-list li');
const mobileServicesLayout = window.matchMedia('(max-width: 680px)');

// Exact totals from the source reports. They cannot be reliably reconstructed
// from the rounded spend and cost-per-lead values shown on the cards.
const caseLeadsByReport = new Map([
    ['img/1.png', 602],
    ['img/2.png', 662],
    ['img/3.png', 211],
    ['img/4.png', 446],
    ['img/5.png', 552],
    ['img/6.png', 314],
    ['img/7.png', 321],
    ['img/9.png', 233],
    ['img/11.png', 119],
    ['img/12.png', 52],
    ['img/13.png', 128],
    ['img/14.png', 125],
    ['img/15.png', 1253],
    ['img/16.png', 50],
    ['img/17.png', 67808],
    ['img/18.png', 3796],
    ['img/19.png', 241],
]);

document.querySelectorAll('.case-footer').forEach((footer) => {
    const spendText = footer.querySelector('.case-spend strong')?.textContent || '';
    const leadPriceText = footer.querySelector('.case-lead-price strong')?.textContent || '';
    const spend = Number(spendText.replace(/\D/g, ''));
    const leadPrice = Number(leadPriceText.replace(/\D/g, ''));
    const priceMetric = footer.querySelector('.case-lead-price');
    const reportPath = footer.closest('.case-card')?.querySelector('.case-media-link')?.getAttribute('href');
    const verifiedLeads = caseLeadsByReport.get(reportPath);

    if (!spend || !leadPrice || !priceMetric || footer.querySelector('.case-leads')) return;

    const leadsMetric = document.createElement('div');
    const leadsLabel = document.createElement('span');
    const leadsValue = document.createElement('strong');

    leadsMetric.className = 'case-metric case-leads';
    leadsLabel.textContent = 'Лиды';
    leadsValue.textContent = (verifiedLeads ?? Math.round(spend / leadPrice)).toLocaleString('ru-RU');
    leadsMetric.append(leadsLabel, leadsValue);
    priceMetric.before(leadsMetric);
});

if (serviceItems.length) {
    const closeServiceItems = () => {
        serviceItems.forEach((item) => {
            item.classList.remove('is-open');
            item.setAttribute('aria-expanded', 'false');
        });
    };

    const syncServiceItems = () => {
        serviceItems.forEach((item) => {
            if (mobileServicesLayout.matches) {
                item.tabIndex = 0;
                item.setAttribute('role', 'button');
                item.setAttribute('aria-expanded', String(item.classList.contains('is-open')));
            } else {
                item.classList.remove('is-open');
                item.removeAttribute('tabindex');
                item.removeAttribute('role');
                item.removeAttribute('aria-expanded');
            }
        });
    };

    const toggleServiceItem = (selectedItem) => {
        if (!mobileServicesLayout.matches) return;
        const willOpen = !selectedItem.classList.contains('is-open');

        serviceItems.forEach((item) => {
            const isOpen = item === selectedItem && willOpen;
            item.classList.toggle('is-open', isOpen);
            item.setAttribute('aria-expanded', String(isOpen));
        });
    };

    serviceItems.forEach((item) => {
        item.addEventListener('click', () => toggleServiceItem(item));
        item.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggleServiceItem(item);
        });
    });

    document.addEventListener('click', (event) => {
        if (!mobileServicesLayout.matches || event.target.closest('.services-list li')) return;
        closeServiceItems();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mobileServicesLayout.matches) closeServiceItems();
    });

    syncServiceItems();
    mobileServicesLayout.addEventListener('change', syncServiceItems);
}

const scrollTopButton = document.querySelector('.scroll-top');

const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach((item) => {
    item.addEventListener('toggle', () => {
        if (!item.open) return;

        faqItems.forEach((otherItem) => {
            if (otherItem !== item) otherItem.open = false;
        });
    });
});

document.querySelectorAll('[data-blog-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.blog-track');
    const controls = carousel.closest('.container')?.querySelector('.blog-controls');
    const previousButton = controls?.querySelector('[data-blog-prev]');
    const nextButton = controls?.querySelector('[data-blog-next]');
    const counter = controls?.querySelector('[data-blog-counter]');
    const cards = track?.querySelectorAll('.blog-card') || [];

    if (!track || !previousButton || !nextButton) return;

    if (cards.length < 2) {
        return;
    }

    controls.hidden = false;

    const cardLeft = (card) => card.offsetLeft - cards[0].offsetLeft;
    const activeCardIndex = () => Array.from(cards).reduce((closestIndex, card, index) => (
        Math.abs(track.scrollLeft - cardLeft(card)) < Math.abs(track.scrollLeft - cardLeft(cards[closestIndex])) ? index : closestIndex
    ), 0);

    const updateControls = () => {
        const maxScroll = track.scrollWidth - track.clientWidth;
        previousButton.disabled = track.scrollLeft <= 2;
        nextButton.disabled = track.scrollLeft >= maxScroll - 2;
        const label = `${activeCardIndex() + 1} / ${cards.length}`;
        if (counter && counter.textContent !== label) counter.textContent = label;
    };

    let controlsFrame = 0;
    const scheduleControlsUpdate = () => {
        if (controlsFrame) return;
        controlsFrame = window.requestAnimationFrame(() => {
            controlsFrame = 0;
            updateControls();
        });
    };

    const moveCarousel = (direction) => {
        const targetIndex = Math.min(cards.length - 1, Math.max(0, activeCardIndex() + direction));
        track.scrollTo({ left: cardLeft(cards[targetIndex]), behavior: 'smooth' });
    };

    previousButton.addEventListener('click', () => moveCarousel(-1));
    nextButton.addEventListener('click', () => moveCarousel(1));
    track.addEventListener('scroll', scheduleControlsUpdate, { passive: true });
    window.addEventListener('resize', scheduleControlsUpdate);
    updateControls();
});

if (scrollTopButton) {
    const syncScrollTopButton = () => {
        scrollTopButton.classList.toggle('is-visible', window.scrollY > 520);
    };

    scrollTopButton.addEventListener('click', () => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    syncScrollTopButton();
    window.addEventListener('scroll', syncScrollTopButton, { passive: true });
}

// Observe after article components are built, including their animated buttons.
const animatedElements = document.querySelectorAll('.photo-snow, .hero-consult-button, .services-contact, .story-contact, .telegram-channel-card, .cta-actions .button, .article-author-actions .button');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const visibleAnimations = new Set();
const syncAnimations = () => {
    visibleAnimations.forEach((element) => {
        const running = !document.hidden && !reducedMotion.matches;
        if (running && element.matches('.photo-snow')) initializeSnow(element);
        element.classList.toggle('motion-paused', !running);
    });
};

if ('IntersectionObserver' in window) {
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting }) => {
            if (isIntersecting) visibleAnimations.add(target);
            else {
                visibleAnimations.delete(target);
                target.classList.add('motion-paused');
            }
        });
        syncAnimations();
    });
    animatedElements.forEach((element) => {
        element.classList.add('motion-paused');
        animationObserver.observe(element);
    });
} else {
    animatedElements.forEach((element) => visibleAnimations.add(element));
    syncAnimations();
}
document.addEventListener('visibilitychange', syncAnimations);
reducedMotion.addEventListener('change', syncAnimations);
