export const workspaceFileUploadLimits = {
	maxBytesPerFile: 25 * 1024 * 1024,
	maxFilesPerBatch: 20,
	maxBytesPerBatch: 100 * 1024 * 1024,
	concurrency: 3,
} as const;
