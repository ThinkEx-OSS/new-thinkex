export {
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	WORKSPACE_AI_CHAT_MODELS as AI_CHAT_MODELS,
} from "#/features/workspaces/ai/models";

export const AI_CHAT_ATTACHMENT_ACCEPT = "image/*";
export const AI_CHAT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const AI_CHAT_MAX_FILES = 4;

export const WORKSPACE_AI_CHAT_ATTACHMENT_POLICY = {
	accept: AI_CHAT_ATTACHMENT_ACCEPT,
	maxFileSize: AI_CHAT_MAX_FILE_SIZE,
	maxFiles: AI_CHAT_MAX_FILES,
} as const;
