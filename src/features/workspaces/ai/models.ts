export const DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID = "auto";

export const WORKSPACE_AI_CHAT_MODELS = [
	{
		id: "auto",
		name: "Auto",
		workersAiModel: "@cf/moonshotai/kimi-k2.6",
	},
		{
			id: "claude-sonnet",
			name: "Claude Sonnet 4.6",
			workersAiModel: "aws-bedrock/global.anthropic.claude-sonnet-4-6",
		},
	{
		id: "chatgpt",
		name: "ChatGPT 5.4",
		workersAiModel: "azure-openai/gpt-5.4",
	},
	{
		id: "gemini",
		name: "Gemini 3 Flash",
		workersAiModel: "google-vertex-ai/google/gemini-3-flash-preview",
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
