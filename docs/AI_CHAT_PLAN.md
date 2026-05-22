# AI Chat Plan

## References

- Local reference clone: `references/chatbot`
- Vercel chatbot source: https://github.com/vercel/chatbot
- AI Elements docs reviewed:
  - https://elements.ai-sdk.dev/docs
  - https://elements.ai-sdk.dev/docs/setup
  - https://elements.ai-sdk.dev/docs/usage

## Current State

`src/components/workspace/AiChatPanel.tsx` is only a shell today. It supports maximize/collapse through `src/stores/ai-chat-panel.ts`, shows a centered message icon, and has a non-interactive "Message AI" placeholder.

The workspace layout already has the right container for a serious chat surface:

- Side panel with resizable width on desktop.
- Maximized chat overlay.
- Workspace context available in `WorkspaceShell`.
- Auth/session plumbing through TanStack Router and existing API route patterns.

The project is already close to AI Elements requirements: React 19, Tailwind CSS 4, shadcn-style components, `streamdown`, and AI-related dependencies are present. The main gap is that this app uses TanStack Start routes, not Next.js App Router, so the Vercel chatbot code should be adapted as patterns, not copied directly.

## Target Experience

Build a workspace-aware assistant panel that feels native to Thinkex:

- Persistent chat panel inside each workspace.
- Streaming assistant responses.
- Markdown rendering with code blocks.
- Prompt input with send/stop states.
- Empty state that suggests workspace-relevant prompts.
- Maximized mode that uses the same chat state.
- Later: workspace item context, chat history, model selection, file attachments, and tool calls.

## Implementation Phases

### 1. Install Or Vendor AI Elements

Add the minimum AI Elements components needed for a first usable chat:

- `message`
- `conversation`
- `prompt-input`
- `reasoning` if we expose reasoning output later
- `code-block` if the installed message renderer does not already cover code well

Use the AI Elements CLI or shadcn registry flow from the docs, but keep generated components under `src/components/ai-elements`. The docs note these components are copied into the app and intended to be customized.

Expected follow-up cleanup:

- Fix aliases from `@/` to `#/` if generated code assumes Next-style aliases.
- Add any missing shadcn primitives required by `prompt-input` such as command, tooltip, hover-card, input-group, spinner, or select.
- Keep styling aligned with the existing compact workspace UI.

### 2. Create A Minimal Chat API

Add a TanStack server route, probably `src/routes/api/v1/ai/chat.ts`, using the AI SDK streaming primitives.

Start smaller than the Vercel reference:

- Accept `{ id, workspaceId, message }`.
- Verify the existing app session with `getSessionFromRequest`.
- Build a system prompt with workspace name and active item metadata.
- Stream text from one configured model.
- Return a UI message stream compatible with `@ai-sdk/react`.

Do not start with Vercel chatbot's full stack of resumable streams, votes, artifacts, BotID, model capabilities, entitlements, or document tools. Those are useful reference patterns for later but too much surface area for the first Thinkex integration.

Environment decision needed before implementation:

- Prefer `AI_GATEWAY_API_KEY` if this app will use Vercel AI Gateway.
- Otherwise define provider-specific env vars, for example `OPENAI_API_KEY` or Anthropic/Gemini keys.

### 3. Replace The Placeholder Panel With A Real Chat Client

Refactor `AiChatPanel` into a composed chat surface:

- Header: compact title, active workspace label, maximize/collapse controls.
- Body: `Conversation`, `ConversationContent`, `Message`, `MessageContent`, `MessageResponse`.
- Footer: `PromptInput` with send/stop button.
- State: `useChat` from `@ai-sdk/react`.

Keep `isMaximized` and `isCollapsed` in the existing Zustand store. Add only chat-specific state where needed, and avoid mixing transcript state into the panel visibility store.

First version behavior:

- Create a stable chat id per workspace session or per browser tab.
- Send the active workspace id and active tab/item context with each request.
- Show assistant streaming output inline.
- Disable submit for empty input.
- Provide a clear error state when the API key or session is missing.

### 4. Add Workspace Context

The assistant should be useful inside a workspace, not a generic chatbot.

Pass these props from `WorkspaceShell` to `AiChatPanel`:

- `workspace`
- `activeTab`
- `activeItem`
- Maybe the full item list summary for navigation and discovery questions.

Use that context in the chat API system prompt:

- Workspace name.
- Current view: root or item.
- Active item title/meta.
- Available item titles and types.

Keep the prompt compact at first. Once real workspace item content exists, add explicit context selection so the app does not dump large documents into every request.

### 5. Persistence

Start with in-memory client chat state for the prototype, then add persistence once the streaming path is stable.

Recommended schema additions:

- `ai_chat`: `id`, `workspaceId`, `userId`, `title`, `createdAt`, `updatedAt`
- `ai_message`: `id`, `chatId`, `role`, `parts`, `createdAt`

Scope persistence by authenticated user and workspace. The Vercel reference's `Chat`, `Message_v2`, and query helpers are a good model, but this app should use its existing Drizzle schema and auth conventions.

### 6. Quality Pass

Add focused tests around:

- Unauthorized chat API requests return 401.
- Invalid request bodies return 400.
- Workspace context is included only for authorized sessions.
- Panel renders empty, streaming, error, and populated message states.

Manual verification:

- Desktop side panel at minimum and maximum widths.
- Maximized overlay.
- Dark and light themes.
- Empty, long message, code block, and streaming states.

## Suggested First PR

The first implementation PR should be intentionally narrow:

1. Add AI Elements message/conversation/prompt input components.
2. Add a minimal authenticated streaming chat API route.
3. Replace the placeholder `AiChatPanel` with a working `useChat` UI.
4. Pass workspace and active item context from `WorkspaceShell`.
5. Add basic request validation and missing-key error handling.

Leave chat history, file attachments, model selector, slash commands, artifacts, voting, resumable streams, and tool approvals for later PRs.
