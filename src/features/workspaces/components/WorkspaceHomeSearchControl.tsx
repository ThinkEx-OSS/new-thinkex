import { Search } from "lucide-react";

import { Input } from "#/components/ui/input";

export function WorkspaceHomeSearchControl({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	disabled: boolean;
}) {
	return (
		<div className="relative w-full min-w-0 max-w-[26rem]">
			<Search
				className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Search workspaces"
				className="h-8 border-0 bg-workspace-chrome-active pl-8 shadow-none focus-visible:border-transparent"
				aria-label="Search workspaces"
				disabled={disabled}
			/>
		</div>
	);
}
