---
name: implement
description: "Implement a piece of work based on a PRD or set of issues."
disable-model-invocation: true
---

Read `docs/agents/README.md` and `AGENTS.md` for repo config (issue tracker, triage labels, git rules) before running this skill.

Implement the work described by the user in the PRD or issues.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Review the work before committing — correctness, scope, tests, and repo conventions.

Commit your work to the current branch.
