export const DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID = "gemini";

export const WORKSPACE_AI_CHAT_MODELS = [
	{
		id: "claude-sonnet",
		name: "Claude Sonnet 4.6",
		gatewayModel: "anthropic/claude-sonnet-4.6",
	},
	{
		id: "chatgpt",
		name: "ChatGPT 5.4",
		gatewayModel: "openai/gpt-5.4",
	},
	{
		id: "gemini",
		name: "Gemini 3 Flash",
		gatewayModel: "google/gemini-3-flash",
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
	).gatewayModel;
}
