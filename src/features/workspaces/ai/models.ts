export const DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID = "glm-4.7-flash";

export const WORKSPACE_AI_CHAT_MODELS = [
	{
		id: "glm-4.7-flash",
		name: "GLM 4.7 Flash",
		workersAiModel: "@cf/zai-org/glm-4.7-flash",
	},
	{
		id: "kimi-k2.6",
		name: "Kimi K2.6",
		workersAiModel: "@cf/moonshotai/kimi-k2.6",
	},
	{
		id: "gemma-4-26b",
		name: "Gemma 4 26B",
		workersAiModel: "@cf/google/gemma-4-26b-a4b-it",
	},
	{
		id: "llama-4-scout",
		name: "Llama 4 Scout 17B",
		workersAiModel: "@cf/meta/llama-4-scout-17b-16e-instruct",
	},
	{
		id: "nemotron-3-120b",
		name: "Nemotron 3 120B",
		workersAiModel: "@cf/nvidia/nemotron-3-120b-a12b",
	},
	{
		id: "gpt-oss-120b",
		name: "GPT-OSS 120B",
		workersAiModel: "@cf/openai/gpt-oss-120b",
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
