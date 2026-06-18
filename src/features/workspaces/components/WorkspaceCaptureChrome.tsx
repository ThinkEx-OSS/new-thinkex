import { useWorkspacePaneHotkey } from "#/features/workspaces/components/WorkspacePaneRuntime";

const captureViewerFrameClassName =
	"pointer-events-none absolute inset-0 z-30 ring-[3px] ring-inset ring-blue-600";

export function WorkspaceCaptureViewerFrame({ active }: { active: boolean }) {
	if (!active) {
		return null;
	}

	return <div aria-hidden className={captureViewerFrameClassName} />;
}

export function WorkspaceCaptureShortcuts({
	isActive,
	onExit,
	onToggle,
}: {
	isActive: boolean;
	onExit: () => void;
	onToggle: () => void;
}) {
	useWorkspacePaneHotkey(
		"Mod+Shift+X",
		(event) => {
			event.preventDefault();
			onToggle();
		},
		{
			ignoreInputs: true,
			preventDefault: false,
			stopPropagation: true,
		},
	);

	useWorkspacePaneHotkey(
		"Escape",
		(event) => {
			event.preventDefault();
			onExit();
		},
		{
			enabled: isActive,
			ignoreInputs: true,
			preventDefault: false,
			stopPropagation: true,
		},
	);

	return null;
}
