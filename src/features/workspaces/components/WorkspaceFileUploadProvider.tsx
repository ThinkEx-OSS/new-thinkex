import {
	type ChangeEvent,
	createContext,
	type ReactNode,
	use,
	useRef,
} from "react";

import { useUploadWorkspaceFileMutation } from "#/features/workspaces/use-workspace-kernel-items";
import { workspaceFileUploadAccept } from "#/features/workspaces/workspace-file-uploads";

interface WorkspaceFileUploadContextValue {
	requestFileUpload: (parentId: string | null) => void;
	uploadFiles: (files: Iterable<File>, parentId: string | null) => void;
}

const WorkspaceFileUploadContext =
	createContext<WorkspaceFileUploadContextValue | null>(null);

export function WorkspaceFileUploadProvider({
	children,
	workspaceId,
}: {
	children: ReactNode;
	workspaceId: string;
}) {
	const uploadWorkspaceFileMutation = useUploadWorkspaceFileMutation();
	const inputRef = useRef<HTMLInputElement>(null);
	const parentIdRef = useRef<string | null>(null);

	const requestFileUpload = (parentId: string | null) => {
		parentIdRef.current = parentId;

		if (inputRef.current) {
			inputRef.current.value = "";
			inputRef.current.click();
		}
	};
	const uploadFiles = (files: Iterable<File>, parentId: string | null) => {
		for (const file of files) {
			uploadWorkspaceFileMutation.mutate({
				workspaceId,
				parentId,
				file,
			});
		}
	};
	const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.currentTarget.files?.[0];

		event.currentTarget.value = "";

		if (!file) {
			return;
		}

		uploadFiles([file], parentIdRef.current);
	};

	return (
		<WorkspaceFileUploadContext.Provider
			value={{ requestFileUpload, uploadFiles }}
		>
			<input
				ref={inputRef}
				type="file"
				accept={workspaceFileUploadAccept}
				aria-label="Upload file"
				className="hidden"
				tabIndex={-1}
				onChange={handleInputChange}
			/>
			{children}
		</WorkspaceFileUploadContext.Provider>
	);
}

export function useWorkspaceFileUpload() {
	const context = use(WorkspaceFileUploadContext);

	if (!context) {
		throw new Error(
			"useWorkspaceFileUpload must be used within WorkspaceFileUploadProvider.",
		);
	}

	return context;
}
