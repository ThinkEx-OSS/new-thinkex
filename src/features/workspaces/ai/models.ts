export const DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID = "kimi-k2.6";

export const WORKSPACE_AI_CHAT_MODELS = [
	{
		id: "kimi-k2.6",
		name: "Kimi K2.6",
		workersAiModel: "@cf/moonshotai/kimi-k2.6",
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
