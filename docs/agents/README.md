# Agents

Entry point: `AGENTS.md`.

## Issues

GitHub via `gh`. Heredoc for bodies.

`gh issue create` · `gh issue view <n> --comments` · `gh issue edit <n> --add-label ready-for-agent`

Labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`

## Domain

`CONTEXT.md` + `docs/adr/` at root. Read if present; create lazily via `/grill-with-docs`.

## Git

`type(scope): subject` — commitlint on commit-msg. Scope required (`workspaces`, `ui`, `ai`, `deps`, …).

Branch `feat/foo-bar` from `main`. PR: Summary, Test plan, `Closes #N`.

## Skills

Auto-loaded from `.agents/skills/`. Which skill to run: `.agents/skills/README.md`.

Feature: grill-with-docs → to-prd → to-issues → implement/TDD → PR. Issue: triage → implement.

Vertical slices on GitHub, not chat-only plans.
