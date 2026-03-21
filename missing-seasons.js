// ==UserScript==
// @name         Jellyfin Missing Seasons
// @namespace    jellyfin-missing-seasons
// @version      1.0.0
// @description  Shows missing seasons in a series as grayed-out indicators using TMDB data.
// @match        */web/index.html*
// @match        */web/*
// @grant        none
// ==/UserScript==

// Jellyfin Missing Seasons Plugin
// Shows missing seasons in a series as grayed-out indicators using TMDB data.
(function () {
    'use strict';

    const PLUGIN_ID = 'jellyfin-missing-seasons';
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
    const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
    const STORAGE_KEY_API = `${PLUGIN_ID}-tmdb-api-key`;
    const POLL_INTERVAL_MS = 500;
    const MAX_POLL_ATTEMPTS = 30;

    // ── Helpers ──────────────────────────────────────────────────────────

    function getApiKey() {
        return localStorage.getItem(STORAGE_KEY_API) || '';
    }

    function setApiKey(key) {
        localStorage.setItem(STORAGE_KEY_API, key.trim());
    }

    function log(...args) {
        console.log(`[MissingSeasons]`, ...args);
    }

    function warn(...args) {
        console.warn(`[MissingSeasons]`, ...args);
    }

    // ── CSS Injection ────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById(`${PLUGIN_ID}-styles`)) return;

        const style = document.createElement('style');
        style.id = `${PLUGIN_ID}-styles`;
        style.textContent = `
            .missing-season-card {
                opacity: 0.4;
                pointer-events: none;
                user-select: none;
                position: relative;
                filter: grayscale(100%);
                transition: opacity 0.3s ease;
            }

            .missing-season-card .cardBox {
                cursor: default !important;
            }

            .missing-season-card .cardScalable {
                cursor: default !important;
            }

            .missing-season-card a {
                pointer-events: none !important;
                cursor: default !important;
            }

            .missing-season-card .cardOverlayButton,
            .missing-season-card .cardOverlayFab,
            .missing-season-card .btnCardOptions {
                display: none !important;
            }

            .missing-season-badge {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0, 0, 0, 0.75);
                color: #ccc;
                padding: 2px 8px;
                border-radius: 3px;
                font-size: 0.75em;
                font-weight: 600;
                z-index: 10;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }

            /* Config dialog */
            .ms-config-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .ms-config-dialog {
                background: #1c1c1e;
                border-radius: 12px;
                padding: 28px 32px;
                max-width: 460px;
                width: 90%;
                color: #e0e0e0;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }

            .ms-config-dialog h2 {
                margin: 0 0 8px 0;
                font-size: 1.25em;
                color: #fff;
            }

            .ms-config-dialog p {
                margin: 0 0 18px 0;
                font-size: 0.85em;
                color: #999;
                line-height: 1.5;
            }

            .ms-config-dialog label {
                display: block;
                font-size: 0.85em;
                margin-bottom: 6px;
                color: #bbb;
            }

            .ms-config-dialog input[type="text"] {
                width: 100%;
                padding: 10px 12px;
                border-radius: 6px;
                border: 1px solid #444;
                background: #2c2c2e;
                color: #fff;
                font-size: 0.95em;
                box-sizing: border-box;
                outline: none;
                transition: border-color 0.2s;
            }

            .ms-config-dialog input[type="text"]:focus {
                border-color: #00a4dc;
            }

            .ms-config-btn-row {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 22px;
            }

            .ms-config-btn {
                padding: 8px 20px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-size: 0.9em;
                font-weight: 500;
            }

            .ms-config-btn-save {
                background: #00a4dc;
                color: #fff;
            }

            .ms-config-btn-save:hover {
                background: #0091c8;
            }

            .ms-config-btn-cancel {
                background: #3a3a3c;
                color: #ccc;
            }

            .ms-config-btn-cancel:hover {
                background: #48484a;
            }

            .ms-config-gear {
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 9999;
                background: rgba(0,0,0,0.6);
                border: 1px solid #444;
                color: #aaa;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 18px;
                transition: color 0.2s, border-color 0.2s;
            }

            .ms-config-gear:hover {
                color: #00a4dc;
                border-color: #00a4dc;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Configuration Dialog ─────────────────────────────────────────────

    function showConfigDialog() {
        // Remove existing dialog if any
        const existing = document.querySelector('.ms-config-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'ms-config-overlay';

        const currentKey = getApiKey();
        const maskedKey = currentKey
            ? escapeHtml(currentKey.substring(0, 4)) + '••••••••' + escapeHtml(currentKey.substring(currentKey.length - 4))
            : '';

        overlay.innerHTML = `
            <div class="ms-config-dialog">
                <h2>Missing Seasons Settings</h2>
                <p>
                    Enter your TMDB API key (v3 auth). Get one free at
                    <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" style="color:#00a4dc;">themoviedb.org</a>.
                </p>
                <label for="ms-tmdb-key">TMDB API Key (v3)</label>
                <input type="text" id="ms-tmdb-key" placeholder="e.g. a1b2c3d4e5f6..." />
                ${maskedKey ? `<p style="margin-top:6px;">Current: <code style="color:#00a4dc;">${maskedKey}</code></p>` : ''}
                <div class="ms-config-btn-row">
                    <button class="ms-config-btn ms-config-btn-cancel" id="ms-cancel">Cancel</button>
                    <button class="ms-config-btn ms-config-btn-save" id="ms-save">Save</button>
                </div>
            </div>
        `;

        // Set value via DOM property (not attribute) to avoid XSS
        const input = overlay.querySelector('#ms-tmdb-key');
        input.value = currentKey;

        document.body.appendChild(overlay);

        overlay.querySelector('#ms-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        overlay.querySelector('#ms-save').addEventListener('click', () => {
            const input = overlay.querySelector('#ms-tmdb-key');
            const val = input.value.trim();
            if (!val) {
                input.style.borderColor = '#ff3b30';
                return;
            }
            setApiKey(val);
            overlay.remove();
            log('TMDB API key saved. Reload the page to see changes.');
            // Re-process current page
            processSeasonsOnCurrentPage();
        });
    }

    function injectGearButton() {
        if (document.getElementById(`${PLUGIN_ID}-gear`)) return;

        const gear = document.createElement('div');
        gear.id = `${PLUGIN_ID}-gear`;
        gear.className = 'ms-config-gear';
        gear.title = 'Missing Seasons Settings';
        gear.innerHTML = '⚙';
        gear.addEventListener('click', showConfigDialog);
        document.body.appendChild(gear);
    }

    // ── TMDB API ─────────────────────────────────────────────────────────

    async function tmdbFetch(path) {
        const apiKey = getApiKey();
        if (!apiKey) {
            warn('No TMDB API key configured.');
            return null;
        }

        const separator = path.includes('?') ? '&' : '?';
        const url = `${TMDB_BASE_URL}${path}${separator}api_key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url);

        if (!response.ok) {
            warn(`TMDB API error: ${response.status} for ${path}`);
            return null;
        }

        return response.json();
    }

    async function getTmdbSeasons(tmdbId) {
        const data = await tmdbFetch(`/tv/${tmdbId}`);
        if (!data || !data.seasons) return [];

        const now = new Date();

        return data.seasons
            .filter(s => {
                // Exclude "Specials" (season 0)
                if (s.season_number === 0) return false;
                // Only include released seasons
                if (!s.air_date) return false;
                return new Date(s.air_date) <= now;
            })
            .map(s => ({
                seasonNumber: s.season_number,
                name: s.name,
                episodeCount: s.episode_count,
                airDate: s.air_date,
                posterPath: s.poster_path,
                overview: s.overview
            }));
    }

    // ── Jellyfin API Helpers ─────────────────────────────────────────────

    function getJellyfinApiClient() {
        // Try multiple approaches to get the API client
        if (window.ApiClient) return window.ApiClient;
        if (window.Emby && window.Emby.ServerConnections) {
            return window.Emby.ServerConnections.currentApiClient();
        }
        // Jellyfin 10.8+
        try {
            const sc = window.ServerConnections || window.connectionManager;
            if (sc) return sc.currentApiClient();
        } catch (e) {
            // ignore
        }
        return null;
    }

    function getJellyfinUserId() {
        const api = getJellyfinApiClient();
        if (!api) return null;
        try {
            return api.getCurrentUserId();
        } catch (e) {
            return null;
        }
    }

    async function getJellyfinSeriesInfo(itemId) {
        const api = getJellyfinApiClient();
        if (!api) return null;

        const userId = getJellyfinUserId();
        if (!userId) return null;

        try {
            const item = await api.getItem(userId, itemId);
            return item;
        } catch (e) {
            warn('Failed to get series info:', e);
            return null;
        }
    }

    async function getJellyfinSeasons(seriesId) {
        const api = getJellyfinApiClient();
        if (!api) return [];

        const userId = getJellyfinUserId();
        if (!userId) return [];

        try {
            const result = await api.getSeasons(seriesId, { userId });
            return result.Items || [];
        } catch (e) {
            warn('Failed to get seasons:', e);
            return [];
        }
    }

    // ── URL / Route Helpers ──────────────────────────────────────────────

    function getSeriesIdFromUrl() {
        // Jellyfin URL patterns:
        // #!/details?id=XXXXX
        // /details?id=XXXXX
        // /items/XXXXX
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        const fullUrl = hash + search;

        // Try hash-based routing
        let match = fullUrl.match(/[?&]id=([a-f0-9]+)/i);
        if (match) return match[1];

        // Try path-based routing
        match = window.location.pathname.match(/\/items\/([a-f0-9]+)/i);
        if (match) return match[1];

        return null;
    }

    // ── Card Builder ─────────────────────────────────────────────────────

    function buildMissingSeasonCard(season, seriesName) {
        const card = document.createElement('div');
        card.setAttribute('data-missing-season', season.seasonNumber);
        card.className = 'card overflowPortraitCard scalableCard overflowPortraitCard-scalable missing-season-card';

        // Sanitize poster path: must be a TMDB path starting with /
        const safePosterPath = season.posterPath && /^\/[a-zA-Z0-9_\-.]+\.\w+$/.test(season.posterPath)
            ? season.posterPath
            : null;

        card.innerHTML = `
            <div class="cardBox cardBox-bottompadded">
                <div class="cardScalable">
                    <div class="cardPadder cardPadder-overflowPortrait"></div>
                    <div class="cardContent">
                        <div class="cardImageContainer coveredImage cardContent-shadow itemAction lazy">
                            <div class="missing-season-badge">Not available</div>
                        </div>
                    </div>
                </div>
                <div class="cardFooter">
                    <div class="cardText cardTextCentered">${escapeHtml(season.name || `Season ${season.seasonNumber}`)}</div>
                    <div class="cardText cardText-secondary cardTextCentered">${season.episodeCount} Episode${season.episodeCount !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `;

        // Set background image via DOM property to avoid style-injection
        const imgContainer = card.querySelector('.cardImageContainer');
        if (safePosterPath) {
            imgContainer.style.backgroundImage = `url('${TMDB_IMAGE_BASE}/w300${safePosterPath}')`;
            imgContainer.style.backgroundSize = 'cover';
            imgContainer.style.backgroundPosition = 'center';
        } else {
            imgContainer.style.background = '#1a1a1a';
        }

        return card;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Core Logic ───────────────────────────────────────────────────────

    async function processSeries(itemId) {
        if (!getApiKey()) {
            log('No TMDB API key configured. Click the gear icon to set one.');
            return;
        }

        const seriesInfo = await getJellyfinSeriesInfo(itemId);
        if (!seriesInfo || seriesInfo.Type !== 'Series') return;

        // Extract TMDB ID
        const tmdbId = seriesInfo.ProviderIds && seriesInfo.ProviderIds.Tmdb;
        if (!tmdbId) {
            log(`No TMDB ID found for "${seriesInfo.Name}". Skipping.`);
            return;
        }

        log(`Processing "${seriesInfo.Name}" (TMDB: ${tmdbId})`);

        // Fetch data in parallel
        const [tmdbSeasons, jellyfinSeasons] = await Promise.all([
            getTmdbSeasons(tmdbId),
            getJellyfinSeasons(itemId)
        ]);

        if (!tmdbSeasons.length) {
            log('No TMDB seasons found or API error.');
            return;
        }

        // Determine which seasons are in Jellyfin
        const localSeasonNumbers = new Set(
            jellyfinSeasons.map(s => s.IndexNumber).filter(n => n != null)
        );

        // Find missing seasons
        const missingSeasons = tmdbSeasons.filter(s => !localSeasonNumbers.has(s.seasonNumber));

        if (!missingSeasons.length) {
            log(`"${seriesInfo.Name}" has all released seasons.`);
            return;
        }

        log(`Found ${missingSeasons.length} missing season(s):`, missingSeasons.map(s => s.name));

        // Wait for the seasons container to be rendered
        injectMissingSeasons(missingSeasons, seriesInfo.Name, localSeasonNumbers, tmdbSeasons);
    }

    function injectMissingSeasons(missingSeasons, seriesName, localSeasonNumbers, allTmdbSeasons) {
        // Find the seasons container — poll until it appears
        let attempts = 0;

        function tryInject() {
            // Remove previously injected missing season cards
            document.querySelectorAll('[data-missing-season]').forEach(el => el.remove());

            // Find the items container that holds season cards
            // Look for the section that contains seasons
            const containers = document.querySelectorAll('.itemsContainer');
            let seasonContainer = null;

            for (const container of containers) {
                // The season container is typically inside a section with "Seasons" header
                const section = container.closest('.verticalSection');
                if (section) {
                    const header = section.querySelector('.sectionTitle');
                    if (header && (header.textContent.includes('Season') || header.textContent.includes('season'))) {
                        seasonContainer = container;
                        break;
                    }
                }
            }

            // Fallback: look for the childrenCollapsible section
            if (!seasonContainer) {
                const childrenSection = document.querySelector('#childrenCollapsible .itemsContainer');
                if (childrenSection) {
                    seasonContainer = childrenSection;
                }
            }

            if (!seasonContainer) {
                attempts++;
                if (attempts < MAX_POLL_ATTEMPTS) {
                    setTimeout(tryInject, POLL_INTERVAL_MS);
                } else {
                    warn('Could not find seasons container after polling.');
                }
                return;
            }

            // Build all season numbers in order for proper insertion
            const allSeasonNumbers = allTmdbSeasons.map(s => s.seasonNumber).sort((a, b) => a - b);

            // Get existing season cards and their season numbers
            const existingCards = seasonContainer.querySelectorAll('.card');
            const existingCardMap = new Map();

            existingCards.forEach(card => {
                // Try to extract season number from card text
                const cardText = card.querySelector('.cardText');
                if (cardText) {
                    const match = cardText.textContent.match(/Season\s+(\d+)/i);
                    if (match) {
                        existingCardMap.set(parseInt(match[1], 10), card);
                    }
                }
            });

            // Insert missing season cards in the correct order
            for (const season of missingSeasons) {
                const card = buildMissingSeasonCard(season, seriesName);

                // Find the right position: after the last card with a lower season number
                let inserted = false;
                for (let i = allSeasonNumbers.length - 1; i >= 0; i--) {
                    const sn = allSeasonNumbers[i];
                    if (sn < season.seasonNumber && (existingCardMap.has(sn) || seasonContainer.querySelector(`[data-missing-season="${sn}"]`))) {
                        const refCard = existingCardMap.get(sn) || seasonContainer.querySelector(`[data-missing-season="${sn}"]`);
                        if (refCard && refCard.nextSibling) {
                            seasonContainer.insertBefore(card, refCard.nextSibling);
                        } else {
                            seasonContainer.appendChild(card);
                        }
                        inserted = true;
                        break;
                    }
                }

                if (!inserted) {
                    // If no lower season exists, prepend or append
                    if (existingCards.length > 0 || seasonContainer.children.length > 0) {
                        const firstChild = seasonContainer.firstChild;
                        // Check if we should go before first
                        const firstExistingSeason = Math.min(...Array.from(localSeasonNumbers));
                        if (season.seasonNumber < firstExistingSeason) {
                            seasonContainer.insertBefore(card, firstChild);
                        } else {
                            seasonContainer.appendChild(card);
                        }
                    } else {
                        seasonContainer.appendChild(card);
                    }
                }
            }

            log('Missing season cards injected.');
        }

        tryInject();
    }

    // ── Page Navigation Handler ──────────────────────────────────────────

    let lastProcessedId = null;
    let processingTimeout = null;

    function processSeasonsOnCurrentPage() {
        const itemId = getSeriesIdFromUrl();
        if (!itemId) return;

        // Avoid duplicate processing
        if (itemId === lastProcessedId) {
            // Still re-inject in case DOM was refreshed
            lastProcessedId = null;
        }

        lastProcessedId = itemId;

        // Debounce to let the page render
        clearTimeout(processingTimeout);
        processingTimeout = setTimeout(() => {
            processSeries(itemId).catch(e => warn('Error processing series:', e));
        }, 1000);
    }

    // ── Initialization ───────────────────────────────────────────────────

    function init() {
        log('Plugin loaded.');
        injectStyles();
        injectGearButton();

        // Listen for Jellyfin SPA navigation events
        // The web client fires 'viewshow' on the document when views change
        document.addEventListener('viewshow', () => {
            setTimeout(processSeasonsOnCurrentPage, 500);
        });

        // Also listen for hashchange as a fallback
        window.addEventListener('hashchange', () => {
            setTimeout(processSeasonsOnCurrentPage, 500);
        });

        // Also use a MutationObserver to catch dynamic content changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added node contains seasons
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.querySelector && (
                                node.querySelector('#childrenCollapsible') ||
                                node.id === 'childrenCollapsible'
                            )) {
                                processSeasonsOnCurrentPage();
                                return;
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Process current page on load
        processSeasonsOnCurrentPage();

        // If no API key is set, show config on first load
        if (!getApiKey()) {
            setTimeout(() => {
                log('No TMDB API key configured. Opening settings...');
                showConfigDialog();
            }, 2000);
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
