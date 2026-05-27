# ThinkEx Architecture

ThinkEx is being migrated to a Cloudflare-native workspace-body architecture.

The current source of truth for this migration is:

- [Workspace Kernel Architecture Draft](./WORKSPACE_KERNEL_ARCHITECTURE_DRAFT.md)

## Current Baseline

- Postgres owns auth, workspace metadata, and workspace membership.
- Postgres no longer owns workspace item trees, content snapshots, item assets, workspace events, item search rows, or per-item user state.
- `WorkspaceKernel` owns workspace body state, committed workspace events, revision assignment, lightweight presence, and coarse realtime event fanout.
- `UserAIStore` owns user-scoped AI thread metadata.
- `AIThread` owns an individual AI conversation. Its current workspace tool lists kernel-backed workspace items through `workspace-kernel-access`; broader read/write tools are still a next step.
- The user-facing document editor is deferred. Documents currently open to a lightweight item surface while the kernel/tree/event foundation settles.

## Target Direction

- `WorkspaceKernel` owns the workspace body and wraps `@cloudflare/shell` as the first low-level filesystem spike.
- Large binaries live in R2, with kernel records pointing to those objects.
- `DocumentSession` owns bursty collaborative editor sessions when an item is open.
- UI commands and AI tools should both call the same kernel API for workspace reads and writes.
- Dynamic Worker execution and Cloudflare Sandbox SDK are optional execution layers, not workspace storage.

This file is intentionally short while the migration is underway. Expand it once the kernel implementation settles.
