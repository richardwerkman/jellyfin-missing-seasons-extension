# Jellyfin Missing Seasons — Copilot Instructions

## Project Overview

A Jellyfin server plugin that injects client-side JavaScript to display missing seasons as grayed-out cards using TMDB metadata. Zero configuration — just install via repository and restart.

- **Current version**: 1.0.3.0
- **Target framework**: .NET 9 / `net9.0`
- **Plugin GUID**: `a4b5c6d7-1234-5678-9abc-def012345678` (dashes stripped in some API calls: `a4b5c6d7123456789abcdef012345678`)
- **Plugin name**: `Missing Seasons`
- **Repository manifest URL**: `https://raw.githubusercontent.com/richardwerkman/jellyfin-missing-seasons-extension/main/manifest.json`
- **GitHub repo**: `https://github.com/richardwerkman/jellyfin-missing-seasons-extension`

---

## Architecture

```
missing-seasons.js (userscript alternative, root)
Jellyfin.Plugin.MissingSeasons/
├── Plugin.cs                        — Plugin registration, GUID, version
├── Jellyfin.Plugin.MissingSeasons.csproj
├── Middleware/
│   └── IndexHtmlCacheBustingStartupFilter.cs  — IStartupFilter, added v1.0.2.0
├── Services/
│   └── StartupService.cs            — IScheduledTask, registers with FileTransformation
├── Web/
│   └── missing-seasons.js           — Embedded resource, served at /MissingSeasons/ClientScript
artifacts/
├── missing-seasons-1.0.1.0.zip
├── missing-seasons-1.0.2.0.zip
└── missing-seasons-1.0.3.0.zip
manifest.json                        — Jellyfin plugin repository manifest
README.md
```

### Key Components

**`missing-seasons.js`** (embedded resource)
- Entry point: `init()` — hooks into `viewshow`, `hashchange`, MutationObserver
- `processSeries(itemId)` — orchestrates TMDB + Jellyfin API calls
- `buildMissingSeasonCard(season)` — creates DOM card with TMDB poster
- `injectMissingSeasons(cards)` — inserts cards in chronological order
- Episode count badge uses native Jellyfin classes: `<div class="cardIndicators"><div class="countIndicator indicator">N</div></div>`
- Missing cards get CSS classes: `card missing-season-card`; pointer-events disabled
- CSS style: `.missing-season-card .cardIndicators { pointer-events: none !important; }`

**`IndexHtmlCacheBustingStartupFilter.cs`** (added v1.0.2.0)
- Implements `IStartupFilter`
- Strips `If-Modified-Since` and `If-None-Match` headers from `index.html` requests
- Sets `Cache-Control: no-store` on responses; removes `Last-Modified` and `ETag`
- Purpose: Prevents 304 responses that bypass FileTransformation injection

**`StartupService.cs`**
- Registers the plugin's JS with the FileTransformation plugin on startup
- Injects `<script src="/MissingSeasons/ClientScript"></script>` into `index.html`

---

## TMDB API

- Uses Jellyfin's internal/public TMDB API key
- Endpoint pattern: `https://api.themoviedb.org/3/tv/{tmdbId}/season/{n}?api_key={key}`
- Only shows already-aired seasons (filters by `air_date`)
- TMDB poster URL: `https://image.tmdb.org/t/p/w300{poster_path}`

---

## Build & Release Process

### 1. Update version
Edit `Jellyfin.Plugin.MissingSeasons/Jellyfin.Plugin.MissingSeasons.csproj`:
```xml
<AssemblyVersion>1.0.X.0</AssemblyVersion>
<FileVersion>1.0.X.0</FileVersion>
<Version>1.0.X.0</Version>
```

### 2. Build
```bash
cd Jellyfin.Plugin.MissingSeasons
dotnet build -c Release
```

### 3. Package
```bash
cd /Users/Richard.Werkman/Dev/Repos/jellyfin-missing-seasons-extension
zip -j artifacts/missing-seasons-1.0.X.0.zip \
    Jellyfin.Plugin.MissingSeasons/bin/Release/net9.0/Jellyfin.Plugin.MissingSeasons.dll
md5 -q artifacts/missing-seasons-1.0.X.0.zip
```

### 4. Update manifest.json
Add a new entry at the **top** of the `versions` array in `manifest.json`. Required fields:
- `version`, `changelog`, `targetAbi`, `sourceUrl`, `checksum`, `timestamp`
- `sourceUrl`: `https://github.com/richardwerkman/jellyfin-missing-seasons-extension/releases/download/vX.X.X.X/missing-seasons-X.X.X.X.zip`
  - Note: actual zips are served from the `artifacts/` folder in the repo, so the URL format may differ. Use raw GitHub URL to `artifacts/`.
- `checksum`: MD5 hash of the zip file

### 5. Commit and push
```bash
git add Jellyfin.Plugin.MissingSeasons/Jellyfin.Plugin.MissingSeasons.csproj \
        Jellyfin.Plugin.MissingSeasons/Web/missing-seasons.js \
        missing-seasons.js \
        artifacts/missing-seasons-1.0.X.0.zip \
        manifest.json
git commit -m "vX.X.X.X: <description>"
git push origin main
```

---

## Deployment to Local Jellyfin Server

The Jellyfin server is at `{{serverinstance}}` (v10.11.6).
Credentials are stored locally — do not commit to git.

### Install plugin via API
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "{{serverinstance}}/Packages/Installed/Missing%20Seasons?assemblyGuid=a4b5c6d7123456789abcdef012345678&version=1.0.X.0&repositoryUrl=https%3A%2F%2Fraw.githubusercontent.com%2Frichardwerkman%2Fjellyfin-missing-seasons-extension%2Fmain%2Fmanifest.json" \
  -H "Authorization: MediaBrowser Token=\"<API_KEY>\""
```

### Restart server
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "{{serverinstance}}/System/Restart" \
  -H "Authorization: MediaBrowser Token=\"<API_KEY>\""
```

### Verify active
```bash
sleep 30 && curl -s "{{serverinstance}}/Plugins" \
  -H "Authorization: MediaBrowser Token=\"<API_KEY>\"" | \
  python3 -c "import sys,json; [print(p['Name'],'v'+p['Version'],'-',p['Status']) for p in json.load(sys.stdin) if 'Missing' in p.get('Name','')]"
```

---

## Jellyfin Native Styling

Episode count badges must use native Jellyfin classes to match theme styling:
```html
<div class="cardIndicators">
  <div class="countIndicator indicator">N</div>
</div>
```
- `cardIndicators` — absolute-positioned container (top-right of card image), from `indicators.scss`
- `countIndicator indicator` — circular badge, theme accent color, from `indicators.scss`
- Source: `jellyfin-web/v10.11.6/src/components/indicators/indicators.scss` and `cardBuilder.js`

Do **not** use custom hardcoded colors (e.g., `#00a4dc`) — always use native classes.

---

## Known Issues / Gotchas

- If `If-Modified-Since` / `If-None-Match` headers are not stripped from `index.html` requests, Jellyfin returns a 304, and FileTransformation never gets to inject the `<script>` tag. The cache-busting middleware fixes this.
- FileTransformation plugin must be installed and initialized before `StartupService` runs. If missing, the script tag won't be injected.
- Plugin GUID in code (`Plugin.cs`) must match the GUID in `manifest.json`.
- The `manifest.json` `checksum` field must be the **MD5** hash (not SHA256) of the zip file. Use `md5 -q` on macOS.
- When testing with Playwright/headless Chrome, set `localStorage` with Jellyfin credentials before navigating to series pages.
