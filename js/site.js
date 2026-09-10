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
    const rawScrollParameter = new URL(window.location.href).searchParams.get('feedScroll');
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
    let isRestoringBlogPosition = false;

    try {
        isRestoringBlogPosition = incomingBlogScrollPosition !== null
            || window.sessionStorage.getItem(blogScrollRestoreKey) === 'true';
    } catch (error) {
        isRestoringBlogPosition = false;
    }

    const restoreBlogScrollPosition = () => {
        if (!isRestoringBlogPosition) return;
        window.scrollTo(0, incomingBlogScrollPosition ?? readBlogScrollPosition());
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

    window.addEventListener('scroll', () => {
        if (!isRestoringBlogPosition) saveBlogScrollPosition();
    }, { passive: true });
    blogIndexGrid.addEventListener('click', (event) => {
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

// Keep the blog index return button consistent with the browser Back button.
document.querySelectorAll('.article-back').forEach((backLink) => {
    if (backLink.closest('.blog-article')) return;
    backLink.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        if (window.history.length > 1) {
            window.history.back();
        } else {
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

document.querySelectorAll('.case-footer').forEach((footer) => {
    const spendText = footer.querySelector('.case-spend strong')?.textContent || '';
    const leadPriceText = footer.querySelector('.case-lead-price strong')?.textContent || '';
    const spend = Number(spendText.replace(/\D/g, ''));
    const leadPrice = Number(leadPriceText.replace(/\D/g, ''));
    const priceMetric = footer.querySelector('.case-lead-price');

    if (!spend || !leadPrice || !priceMetric || footer.querySelector('.case-leads')) return;

    const leadsMetric = document.createElement('div');
    const leadsLabel = document.createElement('span');
    const leadsValue = document.createElement('strong');

    leadsMetric.className = 'case-metric case-leads';
    leadsLabel.textContent = 'Лиды';
    leadsValue.textContent = Math.floor(spend / leadPrice).toLocaleString('ru-RU');
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

const blogArticle = document.querySelector('.blog-article');

if (blogArticle) {
    const articleImages = blogArticle.querySelectorAll('.article-hero-image img, .article-inline-media img');
    const imageLightbox = document.createElement('div');
    const imageLightboxBackdrop = document.createElement('div');
    const imageLightboxDialog = document.createElement('div');
    const imageLightboxClose = document.createElement('button');
    const imageLightboxImage = document.createElement('img');
    let lastFocusedImageLink = null;

    imageLightbox.className = 'article-lightbox';
    imageLightbox.hidden = true;
    imageLightbox.setAttribute('aria-hidden', 'true');
    imageLightboxBackdrop.className = 'article-lightbox-backdrop';
    imageLightboxBackdrop.dataset.imageClose = '';
    imageLightboxDialog.className = 'article-lightbox-dialog';
    imageLightboxDialog.setAttribute('role', 'dialog');
    imageLightboxDialog.setAttribute('aria-modal', 'true');
    imageLightboxDialog.setAttribute('aria-label', 'Просмотр изображения');
    imageLightboxClose.className = 'article-lightbox-close';
    imageLightboxClose.type = 'button';
    imageLightboxClose.dataset.imageClose = '';
    imageLightboxClose.setAttribute('aria-label', 'Закрыть изображение');
    imageLightboxClose.innerHTML = '<span></span><span></span>';
    imageLightboxImage.alt = '';
    imageLightboxDialog.append(imageLightboxClose, imageLightboxImage);
    imageLightbox.append(imageLightboxBackdrop, imageLightboxDialog);
    document.body.append(imageLightbox);

    const closeImageLightbox = () => {
        if (imageLightbox.hidden) return;

        imageLightbox.hidden = true;
        imageLightbox.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('case-modal-open');
        imageLightboxImage.removeAttribute('src');
        if (lastFocusedImageLink instanceof HTMLElement) lastFocusedImageLink.focus();
        lastFocusedImageLink = null;
    };

    const openImageLightbox = (imageLink, image) => {
        lastFocusedImageLink = imageLink;
        imageLightboxImage.src = imageLink.href;
        imageLightboxImage.alt = image.alt || 'Изображение из статьи';
        imageLightbox.hidden = false;
        imageLightbox.setAttribute('aria-hidden', 'false');
        document.body.classList.add('case-modal-open');
        requestAnimationFrame(() => imageLightboxClose.focus());
    };

    articleImages.forEach((image) => {
        if (image.closest('a')) return;

        const imageLink = document.createElement('a');
        imageLink.className = 'article-image-link';
        imageLink.href = image.getAttribute('src');
        imageLink.title = 'Открыть изображение в полном размере';
        imageLink.setAttribute(
            'aria-label',
            image.alt ? `Открыть изображение: ${image.alt}` : 'Открыть изображение в полном размере'
        );
        image.before(imageLink);
        imageLink.append(image);
        imageLink.addEventListener('click', (event) => {
            event.preventDefault();
            openImageLightbox(imageLink, image);
        });
    });

    imageLightbox.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-image-close]')) closeImageLightbox();
    });

    document.addEventListener('keydown', (event) => {
        if (imageLightbox.hidden) return;

        if (event.key === 'Escape') closeImageLightbox();
        if (event.key === 'Tab') {
            event.preventDefault();
            imageLightboxClose.focus();
        }
    });

    const telegramChannelUrl = 'https://t.me/direct_ulin';
    const maxChannelUrl = 'https://max.ru/channel_direct_ulin';
    const articleCatalog = [{"slug":"sayt-za-2-chasa-s-gpt","title":"Сайт за 2 часа с GPT!","date":"8 сентября 2026","image":"sayt-za-2-chasa-s-gpt.png","views":"305"},{"slug":"rasshirennyy-geotargeting-yandex-direct","title":"Расширенный геотаргетинг теперь не отключить!","date":"31 августа 2026","image":"rasshirennyy-geotargeting-yandex-direct.png","views":"567"},{"slug":"agentstvo-ili-frilans-v-2026","title":"Агентство или фриланс в 2026?!","date":"25 августа 2026","image":"agentstvo-ili-frilans-v-2026.jpg","views":"811"},{"slug":"kak-otlichit-reklamu-ot-organiki","title":"А это реклама или органика?","date":"17 августа 2026","image":"yandex-ads-highlighter.jpg","views":"1,3 тыс."},{"slug":"pamyatka-direktologa-2026","title":"Памятка директолога 2026","date":"3 августа 2026","image":"pamyatka-direktologa-2026.jpg","views":"1,9 тыс."},{"slug":"kolltreking-v-yandex-direct","title":"В Яндекс Директе появился свой коллтрекинг!","date":"30 июля 2026","image":"kolltreking-v-yandex-direct.jpg","views":"1,9 тыс."},{"slug":"adaptatsiya-byudzheta-yandex-direct","title":"В Яндекс Директе появилась адаптация бюджета","date":"24 июля 2026","image":"adaptatsiya-byudzheta-yandex-direct.jpg","views":"2 тыс."},{"slug":"raspisanie-pokazov-reklamy","title":"Какое поставить расписание показов?","date":"23 июля 2026","image":"telegram-280.jpg","views":"1,51 тыс."},{"slug":"tsvet-knopki-i-konversiya","title":"Какой цвет кнопки конвертит лучше?","date":"13 июля 2026","image":"telegram-274.jpg","views":"1,82 тыс."},{"slug":"otklyuchat-li-personalizatsiyu","title":"Как понять, отключать ли персонализацию?","date":"7 июля 2026","image":"telegram-273.jpg","views":"1,92 тыс."},{"slug":"zhdat-nedelyu-posle-izmeneniy","title":"Самое сложное в работе с Яндекс Директ","date":"29 июня 2026","image":"telegram-271.jpg","views":"2,08 тыс."},{"slug":"vladelets-schetchika-metriki","title":"Кто владелец счётчика метрики?!","date":"10 июня 2026","image":"telegram-268.png","views":"2,43 тыс."},{"slug":"temnaya-tema-yandex-direct","title":"В Яндекс Директе появилась тёмная тема!","date":"9 июня 2026","image":"yandex-direct-dark-theme.png","views":"2,33 тыс."},{"slug":"otdelnye-posadochnye-stranitsy","title":"Делай больше посадочных страниц!","date":"3 июня 2026","image":"telegram-265.jpg","views":"2,33 тыс."},{"slug":"semantika-i-avtotargeting","title":"Забудь ты уже про сбор семантики!!!","date":"25 мая 2026","image":"telegram-263.jpg","views":"2,5 тыс."},{"slug":"reklama-v-messendzherah-yandex-direct","title":"В Яндекс Директе появилась реклама в мессенджерах!","date":"20 мая 2026","image":"telegram-262.jpg","views":"2,33 тыс."},{"slug":"kak-otklyuchit-personalizatsiyu-v-mk","title":"Как отключить Персонализацию объявлений в МК","date":"13 мая 2026","image":"telegram-261.jpg","views":"2,41 тыс."},{"slug":"personalizatsiya-obyavleniy-yandex-direct","title":"15 мая во всех рк автоматически включится &quot;Персонализация&quot;","date":"12 мая 2026","image":"telegram-260.png","views":"2,2 тыс."},{"slug":"avtotargeting-yandex-direct","title":"Автотаргет Яндекс Директа опирается на:","date":"27 апреля 2026","image":"telegram-259.jpg","views":"2,71 тыс."},{"slug":"sezonnost-v-reklame","title":"Как сезонность влияет на рекламу","date":"14 апреля 2026","image":"telegram-258.jpg","views":"2,23 тыс."},{"slug":"rezervnye-posadochnye-stranitsy-yandex-direct","title":"Резервные посадочные страницы в Яндекс Директ","date":"8 апреля 2026","image":"telegram-257.png","views":"2,15 тыс."},{"slug":"smena-atributsii-i-obuchenie-strategii","title":"Смена атрибуции больше не вызывает переобучение стратегий!","date":"26 марта 2026","image":"telegram-256.png","views":"2,69 тыс."},{"slug":"keys-seks-shop-yandex-direct","title":"Кейс: Секс-шоп в Яндекс Директ","date":"23 марта 2026","image":"adult-store-case.png","views":"2,28 тыс."},{"slug":"kak-zapuskat-tmk","title":"Как правильно запускать ТМК?","date":"11 марта 2026","image":"telegram-254.png","views":"2,16 тыс."},{"slug":"pylesosim-provalnye-auktsiony","title":"Пылесосим провальные аукционы!","date":"5 марта 2026","image":"telegram-253.jpg","views":"2,31 тыс."},{"slug":"masshtabirovanie-dublirovaniem-kampaniy","title":"Ещё один способ масштабирования кампаний","date":"3 марта 2026","image":"telegram-252.png","views":"2,06 тыс."},{"slug":"oshibka-postoyanno-menyat-nastroyki","title":"Самая распространенная ошибка с работой в Яндекс Директ","date":"26 февраля 2026","image":"telegram-251.jpg","views":"2,05 тыс."},{"slug":"strategiya-na-poiske-v-2026","title":"Какую стратегию на поиске выбрать в 2026 году?","date":"18 февраля 2026","image":"telegram-250.jpg","views":"2 тыс."},{"slug":"analiz-poiska-i-rsya","title":"Как анализировать Поиск и РСЯ","date":"10 февраля 2026","image":"telegram-248.jpg","views":"2,34 тыс."},{"slug":"minus-slova-v-novom-mastere-otchetov","title":"В новом мастере отчётов теперь можно минусовать слова!","date":"31 января 2026","image":"telegram-245.png","views":"2,36 тыс."},{"slug":"menshe-ogranicheniy-luchshe-reklama","title":"Чем меньше ограничений – тем лучше работает реклама!","date":"29 января 2026","image":"telegram-244.jpg","views":"2,04 тыс."},{"slug":"korrektirovki-v-reklamnoy-kampanii-na-starte","title":"Какие корректировки ставить в РК на старте?","date":"23 января 2026","image":"telegram-243.jpg","views":"2,05 тыс."},{"slug":"stabilnaya-reklama-yandex-direct","title":"Как сделать рекламу в Яндекс Директ стабильной?","date":"19 января 2026","image":"telegram-241.jpg","views":"2,03 тыс."},{"slug":"reklamnyy-byudzhet-yandex-direct-2026","title":"Какой бюджет выделить на Яндекс Директ в 2026 году?","date":"15 января 2026","image":"telegram-240.jpg","views":"2,22 тыс."},{"slug":"130-lidov-dostavka-sushi","title":"130 лидов по доставке суши за прошлую неделю!","date":"12 января 2026","image":"telegram-239.jpg","views":"2,09 тыс."},{"slug":"chto-vazhno-direktologu-v-2026","title":"Что важно для директолога в 2026 году?","date":"9 января 2026","image":"telegram-236.jpg","views":"1,93 тыс."},{"slug":"s-1-yanvarya-nds-22","title":"С 1 января НДС 22%","date":"29 декабря 2025","image":"telegram-2025-233.jpg","views":"1.76K"},{"slug":"vsegda-ostavlyay-dver-priotkrytoy","title":"Всегда оставляй дверь приоткрытой.","date":"25 декабря 2025","image":"telegram-2025-231.jpg","views":"1.86K"},{"slug":"v-novom-mastere-otchetov-teper-mozhno-chistit-ploschadki","title":"В новом мастере отчётов теперь можно чистить площадки!","date":"16 декабря 2025","image":"telegram-2025-229.png","views":"2.04K"},{"slug":"chto-luchshe-zapuskat-v-internet-magazinah","title":"Что лучше запускать в интернет-магазинах?!","date":"11 декабря 2025","image":"telegram-2025-227.jpg","views":"2.15K"},{"slug":"zapuskay-vtoruyu-tmk","title":"Запускай вторую ТМК!","date":"8 декабря 2025","image":"telegram-2025-225.jpg","views":"1.91K"},{"slug":"nikogda-ne-stav-dnevnoe-ogranichenie-na-akkaunte","title":"Никогда не ставь дневное ограничение на аккаунте!","date":"5 декабря 2025","image":"telegram-2025-224.jpg","views":"2.03K"},{"slug":"kak-zapuskat-ozk-chtoby-rabotala","title":"Как запускать ОЗК чтобы работала","date":"20 ноября 2025","image":"telegram-2025-222.jpg","views":"2.24K"},{"slug":"rasshirenie-dlya-chistki-ploschadok-v-setyah-v1-2","title":"Расширение для чистки площадок в сетях v1.2","date":"12 ноября 2025","image":"telegram-2025-221.png","views":"2.37K"},{"slug":"kak-skachat-kartinki-s-lyubogo-sayta","title":"Как скачать картинки с любого сайта","date":"27 октября 2025","image":"telegram-2025-217.png","views":"2.38K"},{"slug":"tsifry-tsifry-tsifry","title":"Цифры, цифры, цифры!","date":"21 октября 2025","image":"telegram-2025-215.jpg","views":"2.1K"},{"slug":"yandeks-obnovil-direkt-kommander","title":"Яндекс обновил Директ Коммандер!","date":"17 октября 2025","image":"telegram-2025-213.png","views":"1.99K"},{"slug":"v-tilde-est-odna-tsel-dlya-otslezhivaniya-vseh-form-na-sayte","title":"В Тильде есть одна цель для отслеживания всех форм на сайте!","date":"16 октября 2025","image":"telegram-2025-212.jpg","views":"2.07K"},{"slug":"a-zachem-po-brendu-to-pokazyvatsya","title":"А зачем по бренду-то показываться?!","date":"13 октября 2025","image":"telegram-2025-211.jpg","views":"1.89K"},{"slug":"yandeks-anonsiroval-naruzhnuyu-reklamu","title":"Яндекс анонсировал наружную рекламу!","date":"9 октября 2025","image":"telegram-2025-210.png","views":"1.93K"},{"slug":"hotel-uvidet-kak-tvoe-obyavlenie-pokazyvaetsya-na-razlichnyh-saytah","title":"Хотел увидеть как твоё объявление показывается на различных сайтах?","date":"8 октября 2025","image":"telegram-2025-209.jpg","views":"1.8K"},{"slug":"a-tmk-na-klikah-ili-na-konversiyah-zapuskat","title":"А ТМК на кликах или на конверсиях запускать?","date":"3 октября 2025","image":"telegram-2025-207.png","views":"1.98K"},{"slug":"yandeks-obnovil-sertifikatsiyu","title":"Яндекс обновил сертификацию!","date":"1 октября 2025","image":"telegram-2025-206.png","views":"1.64K"},{"slug":"kak-reklamirovat-internet-magazin-v-yandeks-direkt","title":"Как рекламировать интернет-магазин в Яндекс Директ","date":"29 сентября 2025","image":"telegram-2025-205.jpg","views":"1.66K"},{"slug":"yandeks-raskatal-bolee-detalnoe-droblenie-po-geo-v-direkte","title":"Яндекс раскатал более детальное дробление по гео в Директе","date":"26 сентября 2025","image":"telegram-2025-203.png","views":"1.76K"},{"slug":"kak-vam-otelnaya","title":"Как вам отельная?)","date":"22 сентября 2025","image":"telegram-2025-202.jpg","views":"1.88K"},{"slug":"vse-esche-delaesh-lendingi-na-tilde","title":"Всё ещё делаешь лендинги на Тильде?!","date":"16 сентября 2025","image":"telegram-2025-198.png","views":"1.77K"},{"slug":"keys-dostavka-sushi-i-rollov-v-yandeks-direkt","title":"Кейс: Доставка суши и роллов в Яндекс Директ","date":"11 сентября 2025","image":"telegram-2025-197.jpg","views":"1.67K"},{"slug":"kak-v-mk-otklyuchit-galochki-avtotargetinga","title":"Как в МК отключить галочки автотаргетинга","date":"8 сентября 2025","image":"telegram-2025-196.png","views":"1.92K"},{"slug":"1-sentyabrya-den-sushi-i-rollov","title":"1 сентября – ДЕНЬ СУШИ И РОЛЛОВ!!!","date":"2 сентября 2025","image":"telegram-2025-195.png","views":"1.83K"},{"slug":"kursy-bespolezny","title":"Курсы бесполезны","date":"27 августа 2025","image":"telegram-2025-194.jpg","views":"2.02K"},{"slug":"kak-vesti-svoy-tg-kanal-i-zachem-on-voobsche","title":"Как вести свой тг канал и зачем он вообще?!","date":"19 августа 2025","image":"telegram-2025-191.jpg","views":"1.56K"},{"slug":"kombinatornye-obyavleniya-novyy-tip-obyavleniy-v-yandeks-direkt","title":"Комбинаторные объявления – новый тип объявлений в Яндекс Директ!","date":"19 августа 2025","image":"telegram-2025-192.png","views":"1.92K"},{"slug":"tam-dengi-esche-est-na-nedele-popolnyu","title":"Там деньги ещё есть, на неделе пополню","date":"18 августа 2025","image":"telegram-2025-190.jpg","views":"1.35K"},{"slug":"ne-rabotay-s-bednymi","title":"Не работай с бедными","date":"14 августа 2025","image":"telegram-2025-187.jpg","views":"1.23K"},{"slug":"ne-zhdi-krasnoy-plashki-a-obnovi-strategiyu","title":"Не жди красной плашки, а обнови стратегию","date":"11 августа 2025","image":"telegram-2025-185.png","views":"1.29K"},{"slug":"novaya-strategiya-v-yandeks-direkt","title":"Новая стратегия в Яндекс Директ","date":"6 августа 2025","image":"telegram-2025-184.png","views":"1.7K"},{"slug":"nam-ne-nuzhen-kolltreking","title":"Нам не нужен коллтрекинг!","date":"23 июля 2025","image":"telegram-2025-179.jpg","views":"1.84K"},{"slug":"ne-rabotay-bez-100-predoplaty","title":"Не работай без 100% предоплаты","date":"21 июля 2025","image":"telegram-2025-178.jpg","views":"1.55K"},{"slug":"printsip-raboty-rsya-v-2025-godu","title":"Принцип работы РСЯ в 2025 году","date":"18 июля 2025","image":"telegram-2025-177.jpg","views":"1.5K"},{"slug":"snizhaem-cpl-cherez-master-kampaniy","title":"Снижаем CPL через Мастер Кампаний","date":"9 июля 2025","image":"telegram-2025-176.png","views":"1.87K"},{"slug":"kak-massovo-vo-vseh-rk-vybrat-pokazy-po-radiusu","title":"Как массово во всех рк выбрать показы по радиусу","date":"7 июля 2025","image":"telegram-2025-175.jpg","views":"1.65K"},{"slug":"samyy-vazhnyy-blok-sayta-pervyy","title":"Самый важный блок сайта – первый!","date":"4 июля 2025","image":"telegram-2025-174.jpg","views":"1.62K"},{"slug":"kak-otklyuchit-stranitsy-kataloga-v-tmk","title":"Как отключить страницы каталога в ТМК","date":"2 июля 2025","image":"telegram-2025-173.png","views":"1.63K"},{"slug":"kak-ostavit-v-poiske-tolko-reklamnuyu-vydachu","title":"Как оставить в поиске только рекламную выдачу","date":"30 июня 2025","image":"telegram-2025-172.png","views":"1.42K"},{"slug":"v-kakih-nishah-nuzhen-tolko-poisk","title":"В каких нишах нужен только Поиск?","date":"26 июня 2025","image":"telegram-2025-171.jpg","views":"1.52K"},{"slug":"1-novoe-mesto-pokaza-na-poiske-galereya-uslug","title":"+1 новое место показа на поиске: Галерея услуг!","date":"25 июня 2025","image":"telegram-2025-169.png","views":"1.42K"},{"slug":"usloviya-pokaza-reklamy-na-poiske-i-v-rsya","title":"Условия показа рекламы на Поиске и в РСЯ","date":"23 июня 2025","image":"telegram-2025-168.jpg","views":"1.37K"},{"slug":"shapka-sayta-eto-baza","title":"Шапка сайта – это база!","date":"19 июня 2025","image":"telegram-2025-167.jpg","views":"1.43K"},{"slug":"tovarka-bomba-chestno-govorya","title":"Товарка – бомба, честно говоря!","date":"17 июня 2025","image":"telegram-2025-166.png","views":"1.52K"},{"slug":"prosteyshiy-sposob-analizirovat-yandeks-direkt","title":"Простейший способ анализировать Яндекс Директ","date":"10 июня 2025","image":"telegram-2025-163.jpg","views":"1.55K"},{"slug":"pamyatka-direktologa","title":"Памятка директолога","date":"5 июня 2025","image":"telegram-2025-160.jpg","views":"1.83K"},{"slug":"na-chem-sdelat-sayt-dlya-kontekstnoy-reklamy","title":"На чем сделать сайт для контекстной рекламы?","date":"3 июня 2025","image":"telegram-2025-159.jpg","views":"1.49K"},{"slug":"drr-bolshe-ne-nuzhen","title":"ДРР больше не нужен!","date":"30 мая 2025","image":"telegram-2025-156.png","views":"1.54K"},{"slug":"roman-ya-ne-vizhu-nashu-reklamu-na-poiske","title":"- Роман, я не вижу нашу рекламу на Поиске!","date":"29 мая 2025","image":"telegram-2025-155.png","views":"1.43K"},{"slug":"3-usloviya-uspeshnoy-reklamy-v-yandeks-direkt","title":"3 условия успешной рекламы в Яндекс Директ","date":"27 мая 2025","image":"telegram-2025-154.jpg","views":"1.65K"},{"slug":"a-ty-zaregistriroval-svoy-sayt-v-rkn","title":"А ты зарегистрировал свой сайт в РКН?","date":"26 мая 2025","image":"telegram-2025-153.jpg","views":"1.85K"},{"slug":"kak-zapuskat-rsya-v-2025-godu","title":"Как запускать РСЯ в 2025 году?","date":"19 мая 2025","image":"telegram-2025-151.jpg","views":"2.52K"},{"slug":"3-glavnyh-voprosa-klientu","title":"3 главных вопроса клиенту","date":"15 мая 2025","image":"telegram-2025-150.jpg","views":"1.74K"},{"slug":"nastroyka-yandeks-direkta-za-5-000r-i-za-50-000r","title":"Настройка Яндекс Директа за 5.000р. и за 50.000р.","date":"13 мая 2025","image":"telegram-2025-149.jpg","views":"1.49K"},{"slug":"otzyvy-na-sayte-pokazatel-doveriya","title":"Отзывы на сайте - показатель доверия","date":"11 мая 2025","image":"telegram-2025-147.jpg","views":"1.06K"},{"slug":"sayt-iz-neyrokartinok-ne-prodaet","title":"Сайт из нейрокартинок не продает","date":"7 мая 2025","image":"telegram-2025-145.jpg","views":"1.03K"},{"slug":"skolko-vremeni-nado-na-test-v-yandeks-direkt","title":"Сколько времени надо на тест в Яндекс Директ?","date":"5 мая 2025","image":"telegram-2025-143.jpg","views":"912"},{"slug":"mk-za-ozk-ne-rabotaet-govorili-oni","title":"МК за ОЗК не работает, говорили они.","date":"2 мая 2025","image":"telegram-2025-142.png","views":"1.02K"},{"slug":"kak-stat-krutym-direktologom","title":"Как стать крутым директологом","date":"1 мая 2025","image":"telegram-2025-141.jpg","views":"986"},{"slug":"reklamu-na-poiske-vidish-a-ona-est","title":"Рекламу на Поиске видишь? А она есть!","date":"30 апреля 2025","image":"telegram-2025-140.png","views":"842"},{"slug":"korrektirovka-reklamy-na-smart-tv","title":"Корректировка рекламы на Smart TV","date":"29 апреля 2025","image":"telegram-2025-138.jpg","views":"854"},{"slug":"nedelnyy-otchet-zalog-uspeshnoy-reklamy","title":"Недельный отчёт - залог успешной рекламы.","date":"28 апреля 2025","image":"telegram-2025-137.png","views":"891"},{"slug":"zachem-tenchat-direktologu-frilanseru","title":"Зачем тенчат директологу фрилансеру?","date":"25 апреля 2025","image":"telegram-2025-136.jpg","views":"919"},{"slug":"start-za-ozk-oplata-za-konversii","title":"Старт за ОЗК (оплата за конверсии)","date":"23 апреля 2025","image":"telegram-2025-135.jpg","views":"940"},{"slug":"gde-brat-klientov-direktologu-frilanseru-v-2025-godu","title":"Где брать клиентов Директологу фрилансеру в 2025 году?","date":"22 апреля 2025","image":"telegram-2025-134.jpg","views":"834"},{"slug":"kogda-nuzhen-kolltreking","title":"Когда нужен коллтрекинг?","date":"21 апреля 2025","image":"telegram-2025-133.jpg","views":"747"},{"slug":"idealnoe-obyavlenie-na-poiske","title":"Идеальное объявление на Поиске","date":"18 апреля 2025","image":"telegram-2025-132.jpg","views":"864"},{"slug":"vse-esche-chistish-ploschadki-v-mk-togda-my-idem-k-vam","title":"Всё ещё чистишь площадки в МК? Тогда мы идём к вам!","date":"17 апреля 2025","image":"telegram-2025-129.jpg","views":"837"},{"slug":"reputatsiya-dlya-direktologa","title":"Репутация для директолога","date":"16 апреля 2025","image":"telegram-2025-128.jpg","views":"672"},{"slug":"pochemu-mnogo-rk-na-klikah-ploho","title":"Почему много рк на кликах - плохо","date":"14 апреля 2025","image":"telegram-2025-126.jpg","views":"680"},{"slug":"zakladki-po-proektam-ili-kak-vesti-mnogo-proektov","title":"Закладки по проектам или как вести много проектов","date":"10 апреля 2025","image":"telegram-2025-125.jpg","views":"918"},{"slug":"kak-prokachat-rk-za-ozk","title":"Как прокачать рк за ОЗК","date":"9 апреля 2025","image":"telegram-2025-124.jpg","views":"819"},{"slug":"modifikatsiya-rasshireniya-dlya-chistki-ploschadok-v-setyah","title":"Модификация расширения для чистки площадок в сетях","date":"8 апреля 2025","image":"telegram-2025-123.jpg","views":"805"},{"slug":"ponedelnik-direktologa","title":"Понедельник Директолога","date":"7 апреля 2025","image":"telegram-2025-122.jpg","views":"736"},{"slug":"kak-raskrutit-svoy-tg-kanal","title":"Как раскрутить свой ТГ-канал","date":"4 апреля 2025","image":"telegram-2025-120.jpg","views":"746"},{"slug":"kak-direktologu-besplatno-raskrutitsya-v-internete","title":"Как директологу бесплатно раскрутиться в интернете?","date":"2 апреля 2025","image":"telegram-2025-118.jpg","views":"791"},{"slug":"ne-delay-obschuyu-epk-na-poisk-i-seti-odnovremenno","title":"Не делай общую ЕПК на поиск и сети одновременно","date":"28 марта 2025","image":"telegram-2025-115.jpg","views":"726"},{"slug":"obuchenie-strategiy-vo-glave-ugla","title":"Обучение стратегий во главе угла.","date":"25 марта 2025","image":"telegram-2025-112.jpg","views":"763"},{"slug":"reklamiruysya-vezde","title":"Рекламируйся везде!","date":"25 марта 2025","image":"telegram-2025-113.jpg","views":"648"},{"slug":"rasshirenie-dlya-chistki-ploschadok-v-setyah","title":"Расширение для чистки площадок в сетях","date":"22 марта 2025","image":"telegram-2025-111.jpg","views":"1.28K"},{"slug":"snachala-sozdaetsya-sayt-potom-zapuskaetsya-reklama-ne-naoborot","title":"Сначала создаётся сайт, потом запускается реклама — не наоборот!","date":"20 марта 2025","image":"telegram-2025-110.jpg","views":"760"},{"slug":"nado-li-ogranichivat-stoimost-klika-v-setyah-i-na-poiske","title":"Надо ли ограничивать стоимость клика в Сетях и на Поиске","date":"15 марта 2025","image":"telegram-2025-108.jpg","views":"721"},{"slug":"kakoy-byudzhet-vydelit-na-yandeks-direkt-v-2025-godu","title":"Какой бюджет выделить на Яндекс Директ в 2025 году?","date":"13 марта 2025","image":"telegram-2025-107.jpg","views":"688"},{"slug":"keys-dostavka-sushi-i-rollov-v-yandeks-direkt-106","title":"Кейс: Доставка суши и роллов в Яндекс Директ","date":"10 марта 2025","image":"telegram-2025-106.jpg","views":"849"},{"slug":"ne-opuskay-balans-do-0","title":"Не опускай баланс до 0.","date":"9 марта 2025","image":"telegram-2025-105.jpg","views":"642"},{"slug":"kak-umenshat-tsenu-lida-za-ozk","title":"Как уменьшать цену лида за ОЗК","date":"7 марта 2025","image":"telegram-2025-103.jpg","views":"512"},{"slug":"ne-nado-obnovlyat-strategiyu-esli","title":"Не надо обновлять стратегию, если:","date":"6 марта 2025","image":"telegram-2025-102.jpg","views":"479"},{"slug":"kak-chasto-menyat-strategiyu-byudzhet-vnosit-korrektirovki","title":"Как часто менять стратегию/бюджет, вносить корректировки","date":"3 марта 2025","image":"telegram-2025-101.jpg","views":"541"},{"slug":"v-ponedelnik-zhiznenno-vazhno-proverit-balans-akkaunta-on-ne-dolzhen-byt","title":"В понедельник жизненно важно проверить баланс аккаунта. Он не должен быть меньше недельного бюджета…","date":"2 марта 2025","image":"telegram-2025-100.jpg","views":"541"},{"slug":"za-ozk-banyat","title":"За ОЗК банят","date":"28 февраля 2025","image":"telegram-2025-99.jpg","views":"532"},{"slug":"kopirovat-zapuschennuyu-rk-luchshe-cherez-veb-interfeys-a-redaktirovat-u","title":"Копировать запущенную рк лучше через веб-интерфейс, а редактировать уже в Коммандере.","date":"27 февраля 2025","image":"telegram-2025-98.jpg","views":"540"},{"slug":"zachem-chistit-ploschadki-v-rk-za-ozk","title":"Зачем чистить площадки в рк за ОЗК","date":"25 февраля 2025","image":"telegram-2025-96.jpg","views":"529"},{"slug":"zachem-vesti-istoriyu-otchety-po-proektam-dlya-sebya","title":"Зачем вести историю/отчёты по проектам для себя","date":"24 февраля 2025","image":"telegram-2025-94.jpg","views":"498"},{"slug":"kak-iskat-klientov-direktologu-v-2025-godu","title":"Как искать клиентов директологу в 2025 году.","date":"23 февраля 2025","image":"telegram-2025-89.jpg","views":"468"},{"slug":"nikogda-ne-zapuskay-rsya-srazu-na-bolshom-byudzhete","title":"Никогда не запускай РСЯ сразу на большом бюджете.","date":"22 февраля 2025","image":"telegram-2025-88.jpg","views":"455"},{"slug":"ban-za-ozk-oplata-za-konversii-v-2025-godu","title":"Бан за ОЗК (оплата за конверсии) в 2025 году","date":"21 февраля 2025","image":"telegram-2025-87.jpg","views":"456"},{"slug":"uspeshnost-reklamy-v-yandeks-direkt-v-2025-godu-na-90-zavisit-ot-sayta-i","title":"Успешность рекламы в Яндекс Директ в 2025 году на 90% зависит от сайта и продукта.","date":"19 февраля 2025","image":"telegram-2025-86.jpg","views":"465"},{"slug":"chem-prosche-tem-luchshe","title":"&quot;Чем проще, тем лучше&quot;.","date":"18 февраля 2025","image":"telegram-2025-85.jpg","views":"436"},{"slug":"zachem-sobirat-semantiku-esli-est-avtotargeting","title":"Зачем собирать семантику, если есть автотаргетинг?)","date":"16 февраля 2025","image":"telegram-2025-83.jpg","views":"466"},{"slug":"kakuyu-strategiyu-vybrat-v-yandeks-direkte-v-2025","title":"Какую стратегию выбрать в Яндекс Директе в 2025?","date":"15 февраля 2025","image":"telegram-2025-82.jpg","views":"602"},{"slug":"esli-obuchenie-strategii-ostanovilos-to-obnovit-ee-mozhno-v-paru-klikov","title":"Если обучение стратегии остановилось, то обновить её можно в пару кликов через смену атрибуции.","date":"14 февраля 2025","image":"telegram-2025-80.jpg","views":"618"},{"slug":"osnovnye-kommercheskie-klyuchi-dlya-sbora-semantiki","title":"Основные коммерческие ключи для сбора семантики:","date":"7 февраля 2025","image":"../telegram-channel-avatar.jpg","views":"768"},{"slug":"esli-u-vas-net-bogatyh-roditeley-svyazey-vy-rodilis-v-za-zho-muho-i-td-t","title":"Если у вас нет богатых родителей, связей, вы родились в за жо мухо и тд, то единственный выход в 2025…","date":"6 февраля 2025","image":"telegram-2025-75.jpg","views":"512"},{"slug":"ocherednoy-raz-ubezhdayus-v-zolotom-pravile-direkta-rabotaet-ne-lez","title":"Очередной раз убеждаюсь в золотом правиле Директа: &quot;работает - не лезь&quot;.","date":"5 февраля 2025","image":"telegram-2025-74.jpg","views":"431"},{"slug":"master-kampaniy-v-2025-m-godu","title":"Мастер Кампаний в 2025-м году.","date":"30 января 2025","image":"telegram-2025-72.jpg","views":"520"},{"slug":"v-etom-godu-v-direkte-poyavilsya-novyy-vid-reklamnogo-razmescheniya-dina","title":"В этом году в Директе появился новый вид рекламного размещения: &quot;Динамические места на Поиске&quot;","date":"27 января 2025","image":"../telegram-channel-avatar.jpg","views":"582"},{"slug":"https-www-fotor-com","title":"https://www.fotor.com/","date":"22 января 2025","image":"telegram-2025-69.jpg","views":"720"},{"slug":"keys-mobilnyy-vyezdnoy-shinomontazh","title":"Кейс &quot;Мобильный/Выездной шиномонтаж&quot;.","date":"19 января 2025","image":"telegram-2025-67.jpg","views":"584"},{"slug":"stoit-li-obuchat-rk-v-yandeks-direkte-na-tselyah-kolltrekinga","title":"Стоит ли обучать рк в Яндекс Директе на целях коллтрекинга.","date":"17 января 2025","image":"telegram-2025-66.jpg","views":"475"},{"slug":"keys-prokat-gornolyzhnogo-snaryazheniya-v-yandeks-direkt","title":"Кейс: Прокат горнолыжного снаряжения в Яндекс Директ","date":"10 января 2025","image":"telegram-2025-64.jpg","views":"518"}];

    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
    const currentArticleIndex = articleCatalog.findIndex(({ slug }) => canonicalUrl.includes(`/${slug}/`));
    const currentArticle = articleCatalog[currentArticleIndex];
    const previousArticle = currentArticleIndex >= 0
        ? articleCatalog[(currentArticleIndex - 1 + articleCatalog.length) % articleCatalog.length]
        : null;
    const nextArticle = currentArticleIndex >= 0
        ? articleCatalog[(currentArticleIndex + 1) % articleCatalog.length]
        : null;
    const articleMeta = blogArticle.querySelector('.article-meta');

    if (currentArticle && articleMeta) {
        const views = document.createElement('span');
        views.className = 'article-views';
        views.title = 'Просмотры исходной публикации в Telegram';
        views.setAttribute('aria-label', `${currentArticle.views} просмотров исходной публикации в Telegram`);
        views.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span></span>';
        views.querySelector('span').textContent = currentArticle.views;

        const shareButton = document.createElement('button');
        shareButton.className = 'article-share';
        shareButton.type = 'button';
        shareButton.setAttribute('aria-label', 'Поделиться статьёй');
        shareButton.title = 'Поделиться';
        shareButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11 14.5 5.5M20 11l-5.5 5.5M19.5 11H11c-4.1 0-7 2.4-7 7.2 1.6-2.3 3.8-3.4 7-3.4h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="article-share-label">Поделиться</span>';

        const previousLink = document.createElement('a');
        previousLink.className = 'article-nav-arrow article-nav-arrow--previous';
        previousLink.href = `../${previousArticle.slug}/`;
        previousLink.setAttribute('aria-label', `Предыдущая статья: ${previousArticle.title}`);
        previousLink.title = 'Предыдущая статья';
        previousLink.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        const nextLink = document.createElement('a');
        nextLink.className = 'article-nav-arrow article-nav-arrow--next';
        nextLink.href = `../${nextArticle.slug}/`;
        nextLink.setAttribute('aria-label', `Следующая статья: ${nextArticle.title}`);
        nextLink.title = 'Следующая статья';
        nextLink.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        const copyArticleLink = async () => {
            try {
                await navigator.clipboard.writeText(canonicalUrl);
            } catch (error) {
                const temporaryField = document.createElement('textarea');
                temporaryField.value = canonicalUrl;
                temporaryField.setAttribute('readonly', '');
                temporaryField.style.position = 'fixed';
                temporaryField.style.opacity = '0';
                document.body.append(temporaryField);
                temporaryField.select();
                document.execCommand('copy');
                temporaryField.remove();
            }
        };

        shareButton.addEventListener('click', async () => {
            const label = shareButton.querySelector('.article-share-label');
            const showCopiedState = () => {
                shareButton.classList.add('is-copied');
                label.textContent = 'Ссылка скопирована';
                window.setTimeout(() => {
                    shareButton.classList.remove('is-copied');
                    label.textContent = 'Поделиться';
                }, 1800);
            };

            try {
                if (navigator.share) {
                    await navigator.share({ title: document.querySelector('h1')?.textContent || document.title, url: canonicalUrl });
                    return;
                }

                await copyArticleLink();
                showCopiedState();
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    await copyArticleLink();
                    showCopiedState();
                }
            }
        });

        const articleBody = blogArticle.querySelector('.article-body');

        if (articleBody) {
            const reactionPromptPattern = /^(?:👍|🔥|❤️|❤|👏)\s*[,—:;-]?\s*если\b/iu;
            [...articleBody.querySelectorAll(':scope > p')].forEach((paragraph) => {
                if (reactionPromptPattern.test(paragraph.textContent.trim())) {
                    paragraph.remove();
                }
            });

            if (currentArticle.slug === 'pylesosim-provalnye-auktsiony') {
                const attributionParagraph = [...articleBody.querySelectorAll(':scope > p')]
                    .find((paragraph) => paragraph.textContent.includes('Кейс украл у Николая'));

                if (attributionParagraph) {
                    attributionParagraph.textContent = attributionParagraph.textContent
                        .replace(/\s*Кейс украл у Николая\.?/u, '')
                        .trim();
                }
            }

            if (currentArticle.slug === 'avtotargeting-yandex-direct') {
                const outline = articleBody.querySelector('ol');
                const detailItem = outline?.children[1];
                outline?.classList.add('autotarget-outline');
                if (detailItem) {
                    detailItem.textContent = detailItem.textContent.replace(/^1\s+/, '');
                }
            }

            const colorBulletParagraphs = [...articleBody.querySelectorAll(':scope > p')]
                .filter((paragraph) => paragraph.textContent.trim().startsWith('⏺'));

            if (colorBulletParagraphs.length === 3) {
                const colorList = document.createElement('ul');
                const colorNames = ['blue', 'green', 'red'];
                colorList.className = 'color-insights';
                colorBulletParagraphs.forEach((paragraph, index) => {
                    const item = document.createElement('li');
                    item.className = `color-insight color-insight--${colorNames[index]}`;
                    item.textContent = paragraph.textContent.trim().replace(/^⏺\s*/, '');
                    colorList.append(item);
                });
                colorBulletParagraphs[0].before(colorList);
                colorBulletParagraphs.forEach((paragraph) => paragraph.remove());
            }

            const footerActions = document.createElement('div');
            const footerUtilities = document.createElement('div');
            const contactBlock = articleBody.querySelector('.article-contact');
            contactBlock?.remove();
            footerActions.className = 'article-footer-actions';
            footerActions.id = 'article-footer-actions';
            footerUtilities.className = 'article-footer-utilities';
            footerActions.setAttribute('aria-label', 'Навигация и публикация статьи');
            footerUtilities.append(views, shareButton, nextLink);
            footerActions.append(previousLink, footerUtilities);
            articleBody.append(footerActions);
        }
    }

    const articleContainer = blogArticle.querySelector('.container');

    if (currentArticle && articleContainer) {
        const orderedArticles = [
            ...articleCatalog.slice(currentArticleIndex),
            ...articleCatalog.slice(0, currentArticleIndex)
        ];
        const relatedItems = orderedArticles
            .map((article) => {
                const isCurrent = article.slug === currentArticle.slug;
                return `
                <a class="related-article${isCurrent ? ' is-current' : ''}" href="../${article.slug}/"${isCurrent ? ' aria-current="page"' : ''}>
                    <img src="../../img/blog/thumbnails/${article.image.split('/').pop()}.webp" width="168" height="124" alt="" loading="lazy" decoding="async">
                    <span><strong>${article.title}</strong><time>${article.date}</time></span>
                </a>
            `;
            })
            .join('');

        const sidebar = document.createElement('aside');
        sidebar.className = 'article-sidebar';
        sidebar.setAttribute('aria-label', 'Все статьи');
        // New articles can use their original image until a thumbnail is generated.
        sidebar.addEventListener('error', (event) => {
            const image = event.target;
            if (!(image instanceof HTMLImageElement) || !image.closest('.related-article') || image.dataset.originalFallback) return;
            const thumbnailName = image.getAttribute('src')?.split('/').pop();
            const article = articleCatalog.find((item) => `${item.image.split('/').pop()}.webp` === thumbnailName);
            if (article) {
                image.dataset.originalFallback = 'true';
                image.src = `../../img/blog/${article.image}`;
            }
        }, true);
        sidebar.innerHTML = `
                <div class="article-author-actions">
                    <a class="button button-telegram" href="${telegramChannelUrl}" target="_blank" rel="noopener noreferrer" aria-label="Открыть канал Романа Улина в Telegram">
                        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21.6 3.2 18.5 20c-.2 1-1 1.2-1.8.8l-5.4-4-2.6 2.5c-.3.3-.5.5-1 .5l.4-5.6L18.3 5 5.7 12.9l-5.4-1.7c-1.2-.4-1.2-1.2.3-1.8L20 2c1-.4 1.9.2 1.6 1.2z" fill="currentColor"/></svg>
                        Читать в Telegram
                    </a>
                    <a class="button button-max" href="${maxChannelUrl}" target="_blank" rel="noopener noreferrer" aria-label="Открыть канал Романа Улина в MAX">
                        <img src="../../img/max-logo.svg" width="100" height="100" alt="" aria-hidden="true">
                        Читать в MAX
                    </a>
                </div>
            <section class="related-articles">
                <h2>Все статьи</h2>
                <div class="related-articles-list">${relatedItems}</div>
            </section>
        `;
        const channelActions = sidebar.querySelector('.article-author-actions');
        channelActions.classList.add('article-channel-actions');
        channelActions.setAttribute('aria-label', 'Читать в Telegram и MAX');
        const articleBody = blogArticle.querySelector('.article-body');
        if (articleBody) {
            const navigation = articleBody.querySelector('.article-footer-actions');
            if (navigation) navigation.before(channelActions);
            else articleBody.append(channelActions);
        } else {
            articleContainer.append(channelActions);
        }

        const articleHero = articleContainer.querySelector('.article-hero');
        if (articleHero && articleBody) {
            const articleLayout = document.createElement('div');
            articleLayout.className = 'article-layout';
            articleLayout.classList.add('article-layout--paper', 'article-content--paper');
            const readingPaper = document.createElement('div');
            const readingCopy = document.createElement('div');
            const footerActions = articleBody.querySelector('.article-footer-actions');

            readingPaper.className = 'article-reading-paper';
            readingCopy.className = 'article-body article-body--paper-copy';
            [...articleBody.childNodes].forEach((node) => {
                if (node !== footerActions) {
                    readingCopy.append(node);
                }
            });
            readingPaper.append(articleHero, readingCopy);
            if (footerActions) {
                readingPaper.append(footerActions);
            }
            articleBody.classList.add('article-body--paper-tail');
            articleLayout.append(readingPaper, sidebar);
            articleBody.remove();
            articleContainer.append(articleLayout);
        } else {
            articleContainer.append(sidebar);
        }

        const relatedArticlesList = sidebar.querySelector('.related-articles-list');
        if (relatedArticlesList) {
            window.requestAnimationFrame(() => {
                relatedArticlesList.scrollTop = 0;

                try {
                    const cleanUrl = new URL(window.location.href);
                    if (cleanUrl.searchParams.has('feedScroll')) {
                        cleanUrl.searchParams.delete('feedScroll');
                        window.history.replaceState(window.history.state, '', cleanUrl.href);
                    }
                } catch (error) {
                    // Cleaning an old scroll parameter is optional for local files.
                }
            });
        }
    }
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
