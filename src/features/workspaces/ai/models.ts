export const DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID = "gemini";

// Provider grouping order for the model picker. Models are listed under their
// provider in this order.
export const WORKSPACE_AI_CHAT_PROVIDERS = [
	{ id: "anthropic", label: "Anthropic" },
	{ id: "openai", label: "OpenAI" },
	{ id: "google", label: "Google" },
] as const;

export type WorkspaceAiChatProvider =
	(typeof WORKSPACE_AI_CHAT_PROVIDERS)[number]["id"];

// Simple 1-4 scales aimed at non-technical users. Higher is "more" of the
// named quality (faster, smarter, pricier) — rendered as little segment bars in
// the picker, never as raw numbers or benchmark jargon.
export type WorkspaceAiChatModelLevel = 1 | 2 | 3 | 4;

// Slugs, names, context windows, and pricing are sourced from the live Vercel
// AI Gateway catalog (GET https://ai-gateway.vercel.sh/v1/models). The 1-4
// cost level is derived from each model's real output-token price; speed and
// intelligence are relative, lay-friendly estimates.
export const WORKSPACE_AI_CHAT_MODELS = [
	{
		id: "auto",
		name: "Auto",
		// ThinkEx's own "let us pick for you" option. Routed to a strong general
		// model under the hood (Kimi K2.6 for now); the slug can change without
		// affecting the user-facing choice.
		gatewayModel: "moonshotai/kimi-k2.6",
		provider: "auto",
		tagline: "Picks the best model for you",
		description:
			"Let ThinkEx choose a great model for each message, so you don't have to think about it. A smart, well-rounded default that works for almost anything.",
		bestFor: "When you're not sure",
		intelligence: 3,
		speed: 3,
		cost: 1,
	},
	{
		id: "claude-sonnet",
		name: "Claude Sonnet 4.6",
		gatewayModel: "anthropic/claude-sonnet-4.6",
		provider: "anthropic",
		tagline: "Balanced all-rounder",
		description:
			"A great everyday choice that balances quality and speed. Handles most questions, writing, and coding well without the wait.",
		bestFor: "Everyday tasks & writing",
		intelligence: 3,
		speed: 3,
		cost: 4,
	},
	{
		id: "claude-haiku",
		name: "Claude Haiku 4.5",
		gatewayModel: "anthropic/claude-haiku-4.5",
		provider: "anthropic",
		tagline: "Quick and light",
		description:
			"The fastest, most affordable Claude. Ideal for quick answers, short drafts, and simple tasks where speed matters more than depth.",
		bestFor: "Quick answers & drafts",
		intelligence: 2,
		speed: 4,
		cost: 1,
	},
	{
		id: "chatgpt",
		name: "ChatGPT 5.4",
		gatewayModel: "openai/gpt-5.4",
		provider: "openai",
		tagline: "Versatile and creative",
		description:
			"A capable all-rounder from OpenAI. Strong at creative writing, brainstorming, and general questions for everyday use.",
		bestFor: "Brainstorming & creativity",
		intelligence: 4,
		speed: 3,
		cost: 4,
	},
	{
		id: "chatgpt-mini",
		name: "ChatGPT 5.4 mini",
		gatewayModel: "openai/gpt-5.4-mini",
		provider: "openai",
		tagline: "Fast and affordable",
		description:
			"A lighter, speedier version of ChatGPT. Great for everyday questions and quick help when you don't need the heaviest model.",
		bestFor: "Quick everyday help",
		intelligence: 2,
		speed: 4,
		cost: 1,
	},
	{
		id: "gemini-pro",
		name: "Gemini 3.1 Pro",
		gatewayModel: "google/gemini-3.1-pro-preview",
		provider: "google",
		tagline: "Powerful and thorough",
		description:
			"Google's most capable model. Excellent with large amounts of information, research, and detailed step-by-step answers.",
		bestFor: "Research & long context",
		intelligence: 4,
		speed: 2,
		cost: 3,
	},
	{
		id: "gemini",
		name: "Gemini 3 Flash",
		gatewayModel: "google/gemini-3-flash",
		provider: "google",
		tagline: "Speedy and efficient",
		description:
			"Google's fast model and a solid default. Quick, capable, and well-suited to most day-to-day questions.",
		bestFor: "Fast, everyday answers",
		intelligence: 3,
		speed: 4,
		cost: 1,
	},
] as const;

export type WorkspaceAiChatModel = (typeof WORKSPACE_AI_CHAT_MODELS)[number];

export type WorkspaceAiChatModelId = WorkspaceAiChatModel["id"];

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

export function getWorkspaceAiChatModelById(
	modelId: WorkspaceAiChatModelId,
): WorkspaceAiChatModel {
	return (
		WORKSPACE_AI_CHAT_MODELS.find((model) => model.id === modelId) ??
		WORKSPACE_AI_CHAT_MODELS.find(
			(model) => model.id === DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
		) ??
		WORKSPACE_AI_CHAT_MODELS[0]
	);
}

export function getWorkspaceAiChatModel(modelId: WorkspaceAiChatModelId) {
	return getWorkspaceAiChatModelById(modelId).gatewayModel;
}
