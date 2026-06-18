/** Shared layout + appearance tokens for workspace item cards. */

export const WORKSPACE_ITEM_PREVIEW_CONTROL_ROW = "2.5rem";

export const workspaceItemPreviewControlClass =
	"relative z-20 rounded-[4px] border border-border/80 bg-card/95 text-muted-foreground shadow-none backdrop-blur-md transition-[background-color,border-color,color,opacity] hover:border-foreground/30 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-white/15 dark:bg-card/90 dark:text-muted-foreground dark:hover:border-white/35 dark:hover:bg-secondary dark:hover:text-foreground/95 data-popup-open:border-foreground/30 data-popup-open:bg-secondary data-popup-open:text-foreground dark:data-popup-open:border-white/35 dark:data-popup-open:bg-secondary dark:data-popup-open:text-foreground/95";

export const workspaceItemPreviewControlOverlayClass =
	"pointer-events-none opacity-0 transition-opacity group-hover/item:pointer-events-auto group-hover/item:opacity-100 data-popup-open:pointer-events-auto data-popup-open:opacity-100";

export const workspaceItemPreviewControlSelectedClass =
	"pointer-events-auto border-foreground/45 bg-secondary text-foreground opacity-100 dark:border-white/40 dark:bg-secondary dark:text-foreground";

export const workspaceItemCardBaseClass =
	"workspace-item-card group/item relative flex h-full min-h-44 cursor-pointer flex-col gap-0 overflow-hidden py-0 transition-all active:cursor-grabbing";

export const workspaceItemCardHoverClass =
	"hover:bg-secondary dark:hover:bg-accent/75";

export const workspaceItemCardUnselectedHoverClass =
	"not-data-[selected=true]:hover:shadow-md not-data-[selected=true]:hover:ring-foreground/15 dark:not-data-[selected=true]:hover:ring-foreground/18";

export const workspaceItemCardSelectedClass =
	"data-[selected=true]:ring-2 data-[selected=true]:ring-white data-[selected=true]:ring-offset-2 data-[selected=true]:ring-offset-background data-[selected=true]:shadow-[0_0_0_2px_rgba(15,23,42,0.34),0_0_0_5px_rgba(15,23,42,0.08),0_16px_36px_rgba(15,23,42,0.20)] dark:data-[selected=true]:shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_0_0_5px_rgba(255,255,255,0.08),0_16px_36px_rgba(0,0,0,0.45)]";

export const workspaceItemDocumentPreviewTextClass =
	"line-clamp-[11] px-3 pt-2 pb-3 text-[11px] leading-[1.45] text-muted-foreground/70";
