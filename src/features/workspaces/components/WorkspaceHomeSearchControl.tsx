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
		<div className="relative min-w-0 flex-1">
			<Search
				className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Search workspaces"
				className="h-8 pl-8"
				aria-label="Search workspaces"
				disabled={disabled}
			/>
		</div>
	);
}
