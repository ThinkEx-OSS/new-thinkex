# Agents

Config for [mattpocock/skills](https://github.com/mattpocock/skills). Entry point: `AGENTS.md`.

## Issues

GitHub via `gh`. Heredoc for bodies.

`gh issue create` · `gh issue view <n> --comments` · `gh issue edit <n> --add-label ready-for-agent`

Labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`

## Domain

`CONTEXT.md` + `docs/adr/` at root. Read if present; create lazily via `/grill-with-docs`.

## Git

`type(scope): subject` — commitlint on commit-msg. Scope required (`workspaces`, `ui`, `ai`, `deps`, …).

Branch `feat/foo-bar` from `main`. PR: Summary, Test plan, `Closes #N`.

## Workflow

```bash
npx skills add mattpocock/skills --skill grill-with-docs
npx skills add mattpocock/skills --skill to-prd --skill to-issues --skill implement --skill tdd
```

Feature: grill → PRD → issues → implement/TDD → PR. Issue: triage → implement. `/ask-matt` to route.

Vertical slices on GitHub, not chat-only plans.
