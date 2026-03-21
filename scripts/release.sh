#!/usr/bin/env bash
# release.sh — Build and publish a new version of the Missing Seasons plugin.
#
# What it does:
#   1. Validates that the working tree is clean
#   2. Bumps the version in Jellyfin.Plugin.MissingSeasons.csproj
#   3. Builds the project in Release mode
#   4. Packages the DLL as artifacts/missing-seasons-<version>.zip
#   5. Computes the MD5 checksum
#   6. Prepends the new entry to manifest.json
#   7. Commits the changed files, creates a git tag, and pushes
#
# Usage:
#   ./scripts/release.sh <version> <changelog>
#
# Examples:
#   ./scripts/release.sh 1.0.5.0 "Fix episode count badge on Jellyfin 10.12"
#   ./scripts/release.sh 1.0.6.0 "Add support for anime specials"

set -euo pipefail

# ── Usage ─────────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 <version> <changelog>"
  echo ""
  echo "  version    New version in X.Y.Z.W format, e.g. 1.0.5.0"
  echo "  changelog  Release description (quoted), e.g. \"Fix X and improve Y\""
  echo ""
  echo "Example:"
  echo "  $0 1.0.5.0 \"Fix episode count badge on Jellyfin 10.12\""
  exit 1
}

[[ $# -lt 2 ]] && usage

NEW_VERSION="$1"
CHANGELOG="$2"

# ── Paths ─────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSPROJ="$REPO_ROOT/Jellyfin.Plugin.MissingSeasons/Jellyfin.Plugin.MissingSeasons.csproj"
MANIFEST="$REPO_ROOT/manifest.json"
ARTIFACTS_DIR="$REPO_ROOT/artifacts"
DLL_PATH="$REPO_ROOT/Jellyfin.Plugin.MissingSeasons/bin/Release/net9.0/Jellyfin.Plugin.MissingSeasons.dll"

# ── Helpers ───────────────────────────────────────────────────────────────────

log() { echo "▶ $*"; }
ok()  { echo "✔ $*"; }
err() { echo "✗ $*" >&2; exit 1; }

# ── Validate inputs ───────────────────────────────────────────────────────────

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  err "Version must be in X.Y.Z.W format (e.g. 1.0.5.0)."
fi

if [[ -z "$CHANGELOG" ]]; then
  err "Changelog must not be empty."
fi

# ── Check working tree is clean ───────────────────────────────────────────────

if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
  err "There are uncommitted changes. Commit or stash them before releasing."
fi

# ── Check version is not already released ────────────────────────────────────

if git -C "$REPO_ROOT" tag | grep -qx "v${NEW_VERSION}"; then
  err "Tag v${NEW_VERSION} already exists. Choose a different version."
fi

if python3 -c "
import json, sys
with open('$MANIFEST') as f:
    data = json.load(f)
versions = [v['version'] for v in data[0]['versions']]
sys.exit(0 if '$NEW_VERSION' in versions else 1)
" 2>/dev/null; then
  err "Version ${NEW_VERSION} is already in manifest.json. Choose a different version."
fi

# ── Step 1: Bump version in .csproj ──────────────────────────────────────────

OLD_VERSION=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' "$CSPROJ" | head -1)
log "Bumping version: ${OLD_VERSION} → ${NEW_VERSION}"

sed -i '' "s|<AssemblyVersion>${OLD_VERSION}</AssemblyVersion>|<AssemblyVersion>${NEW_VERSION}</AssemblyVersion>|g" "$CSPROJ"
sed -i ''     "s|<FileVersion>${OLD_VERSION}</FileVersion>|<FileVersion>${NEW_VERSION}</FileVersion>|g"             "$CSPROJ"
sed -i ''         "s|<Version>${OLD_VERSION}</Version>|<Version>${NEW_VERSION}</Version>|g"                         "$CSPROJ"

ok ".csproj updated."

# ── Step 2: Build ─────────────────────────────────────────────────────────────

log "Building release..."
dotnet build -c Release "$CSPROJ" --nologo -v q
ok "Build complete."

# ── Step 3: Package ───────────────────────────────────────────────────────────

ZIP_NAME="missing-seasons-${NEW_VERSION}.zip"
ZIP_PATH="$ARTIFACTS_DIR/${ZIP_NAME}"

mkdir -p "$ARTIFACTS_DIR"
rm -f "$ZIP_PATH"
zip -j "$ZIP_PATH" "$DLL_PATH"
ok "Artifact: artifacts/${ZIP_NAME}"

# ── Step 4: Checksum ──────────────────────────────────────────────────────────

CHECKSUM=$(md5 -q "$ZIP_PATH")
ok "MD5: ${CHECKSUM}"

# ── Step 5: Update manifest.json ─────────────────────────────────────────────

TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

python3 - <<PYEOF
import json

with open("$MANIFEST") as f:
    data = json.load(f)

new_entry = {
    "version": "$NEW_VERSION",
    "changelog": "$CHANGELOG",
    "targetAbi": "10.11.0.0",
    "sourceUrl": "https://github.com/richardwerkman/jellyfin-missing-seasons-extension/raw/main/artifacts/$ZIP_NAME",
    "checksum": "$CHECKSUM",
    "timestamp": "$TIMESTAMP",
}

data[0]["versions"].insert(0, new_entry)

with open("$MANIFEST", "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"manifest.json updated with v$NEW_VERSION")
PYEOF

# ── Step 6: Commit, tag, push ─────────────────────────────────────────────────

log "Committing..."
git -C "$REPO_ROOT" add "$CSPROJ" "$MANIFEST" "$ZIP_PATH"
git -C "$REPO_ROOT" commit -m "v${NEW_VERSION}: ${CHANGELOG}"

TAG="v${NEW_VERSION}"
git -C "$REPO_ROOT" tag "$TAG"
ok "Tagged: ${TAG}"

git -C "$REPO_ROOT" push origin main
git -C "$REPO_ROOT" push origin "$TAG"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Released v${NEW_VERSION}"
echo "  Artifact : artifacts/${ZIP_NAME}"
echo "  Checksum : ${CHECKSUM}"
echo "  Tag      : ${TAG}"
echo "════════════════════════════════════════════════════════"
