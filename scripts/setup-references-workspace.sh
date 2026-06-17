#!/usr/bin/env bash
set -euo pipefail

WEB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_ROOT="$(cd "$WEB_ROOT/.." && pwd)"
REFERENCES_DIR="${REFERENCES_DIR:-$MONOREPO_ROOT/references}"
LEGACY_WEB_REFERENCES="$WEB_ROOT/references"
LEGACY_SIBLING_REFERENCES="$MONOREPO_ROOT/../new-thinkex-references"

mkdir -p "$REFERENCES_DIR"

move_legacy_entries() {
	local source_dir="$1"

	if [[ ! -d "$source_dir" ]]; then
		return
	fi

	if [[ -z "$(ls -A "$source_dir" 2>/dev/null || true)" ]]; then
		rmdir "$source_dir" 2>/dev/null || true
		return
	fi

	echo "Moving local reference clones from $source_dir to $REFERENCES_DIR"

	for entry in "$source_dir"/*; do
		name="$(basename "$entry")"
		target="$REFERENCES_DIR/$name"

		if [[ -e "$target" ]]; then
			echo "Skipping $name (already exists in references dir)"
			continue
		fi

		mv "$entry" "$target"
	done

	if [[ -z "$(ls -A "$source_dir" 2>/dev/null || true)" ]]; then
		rmdir "$source_dir" 2>/dev/null || true
	fi
}

move_legacy_entries "$LEGACY_WEB_REFERENCES"
move_legacy_entries "$LEGACY_SIBLING_REFERENCES"

if [[ ! -f "$REFERENCES_DIR/.cursorindexingignore" ]]; then
	cat >"$REFERENCES_DIR/.cursorindexingignore" <<'EOF'
# Keep local reference clones searchable without indexing heavy/generated paths.
**/.git/**
**/node_modules/**
**/dist/**
**/build/**
**/.next/**
**/.turbo/**
**/.cache/**
**/coverage/**
**/*.lock
**/pnpm-lock.yaml
EOF
fi

echo "Monorepo root: $MONOREPO_ROOT"
echo "References directory: $REFERENCES_DIR"
echo "Open the workspace with: $MONOREPO_ROOT/new-thinkex.code-workspace"
