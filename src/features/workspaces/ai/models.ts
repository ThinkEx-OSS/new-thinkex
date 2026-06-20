export const DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID = "auto";

export const WORKSPACE_AI_CHAT_MODELS = [
	{
		id: "auto",
		name: "Auto",
		workersAiModel: "@cf/moonshotai/kimi-k2.6",
	},
	{
		id: "claude-sonnet",
		name: "Claude Sonnet",
		workersAiModel: "anthropic/claude-sonnet-4-5",
	},
	{
		id: "chatgpt",
		name: "ChatGPT",
		workersAiModel: "openai/gpt-5.2",
	},
	{
		id: "gemini",
		name: "Gemini",
		workersAiModel: "google-vertex-ai/google/gemini-2.5-pro",
	},
] as const;

export type WorkspaceAiChatModelId =
	(typeof WORKSPACE_AI_CHAT_MODELS)[number]["id"];

export function resolveWorkspaceAiChatModelId(
	value: unknown,
): WorkspaceAiChatModelId {
	if (
		typeof value === "string" &&
		WORKSPACE_AI_CHAT_MODELS.some((model) => model.id === value)
	) {
		return value as WorkspaceAiChatModelId;
	}

	return DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID;
}

export function getWorkspaceAiChatModel(modelId: WorkspaceAiChatModelId) {
	return (
		WORKSPACE_AI_CHAT_MODELS.find((model) => model.id === modelId) ??
		WORKSPACE_AI_CHAT_MODELS.find(
			(model) => model.id === DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
		) ??
		WORKSPACE_AI_CHAT_MODELS[0]
	).workersAiModel;
}
