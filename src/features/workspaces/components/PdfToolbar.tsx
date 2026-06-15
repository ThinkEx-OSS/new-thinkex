import {
	Camera,
	Download,
	EllipsisVertical,
	Link2,
	Printer,
} from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { workspaceItemToolbarIconButtonClass } from "#/features/workspaces/components/workspace-item-toolbar-styles";

export function PdfToolbar({
	fileName,
	fileUrl,
}: {
	fileName: string;
	fileUrl: string;
}) {
	const handleDownload = () => {
		const link = document.createElement("a");
		link.href = fileUrl;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		link.remove();
	};

	return (
		<div className="flex max-w-full items-center gap-1 overflow-x-auto">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-8 gap-1.5 px-2.5 text-muted-foreground text-sm hover:bg-transparent hover:text-foreground"
				disabled
			>
				<Camera className="size-3.5" />
				Capture
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className={workspaceItemToolbarIconButtonClass}
							aria-label="More PDF actions"
						/>
					}
				>
					<EllipsisVertical />
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-48" align="end">
					<DropdownMenuGroup>
						<DropdownMenuLabel>File</DropdownMenuLabel>
						<DropdownMenuItem
							className="[&_svg:not([class*='size-'])]:size-4"
							onClick={handleDownload}
						>
							<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
								<Download />
							</span>
							Download file
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem
							className="[&_svg:not([class*='size-'])]:size-4"
							disabled
						>
							<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
								<Printer />
							</span>
							Print
						</DropdownMenuItem>
						<DropdownMenuItem
							className="[&_svg:not([class*='size-'])]:size-4"
							disabled
						>
							<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
								<Link2 />
							</span>
							Copy file link
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
