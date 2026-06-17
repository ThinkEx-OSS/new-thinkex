#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REFERENCES_DIR="${REFERENCES_DIR:-$ROOT/../new-thinkex-references}"
LEGACY_DIR="$ROOT/references"

mkdir -p "$REFERENCES_DIR"

if [[ -d "$LEGACY_DIR" ]]; then
	if [[ -z "$(ls -A "$LEGACY_DIR" 2>/dev/null || true)" ]]; then
		rmdir "$LEGACY_DIR" 2>/dev/null || true
	else
		echo "Moving local reference clones to $REFERENCES_DIR"
		for entry in "$LEGACY_DIR"/*; do
			name="$(basename "$entry")"
			target="$REFERENCES_DIR/$name"

			if [[ -e "$target" ]]; then
				echo "Skipping $name (already exists in references dir)"
				continue
			fi

			mv "$entry" "$target"
		done

		if [[ -z "$(ls -A "$LEGACY_DIR" 2>/dev/null || true)" ]]; then
			rmdir "$LEGACY_DIR" 2>/dev/null || true
		fi
	fi
fi

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

echo "References directory: $REFERENCES_DIR"
echo "Open the repo with: $ROOT/new-thinkex.code-workspace"
