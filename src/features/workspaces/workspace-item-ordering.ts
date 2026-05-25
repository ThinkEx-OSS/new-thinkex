import type {
	WorkspaceItemReorderRow,
	WorkspaceItemSummary,
} from "#/features/workspaces/contracts";

export const WORKSPACE_ITEM_SORT_ORDER_STEP = 1000;

export const workspaceItemOrderingMutationKey = [
	"workspace-items",
	"ordering",
] as const;

export const workspaceItemOrderingMutationScope = {
	id: "workspace-items-ordering",
} as const;

export function getWorkspaceItemOrderScopeKey(input: {
	workspaceId: string;
	parentId: string | null;
	row: WorkspaceItemReorderRow;
}) {
	return [input.workspaceId, input.parentId ?? "root", input.row].join(":");
}

export function getWorkspaceItemOrderRow(
	item: Pick<WorkspaceItemSummary, "type">,
): WorkspaceItemReorderRow {
	return item.type === "folder" ? "folder" : "item";
}

export function isWorkspaceItemInOrderRow(
	item: Pick<WorkspaceItemSummary, "parentId" | "type">,
	input: { parentId: string | null; row: WorkspaceItemReorderRow },
) {
	return (
		item.parentId === input.parentId &&
		getWorkspaceItemOrderRow(item) === input.row
	);
}

export function getWorkspaceItemRowOrders<TItem extends WorkspaceItemSummary>(
	items: TItem[],
	workspaceId: string,
) {
	const rows = new Map<string, TItem[]>();

	for (const item of items) {
		const rowItems = rows.get(
			getWorkspaceItemOrderScopeKey({
				workspaceId,
				parentId: item.parentId,
				row: getWorkspaceItemOrderRow(item),
			}),
		);

		if (rowItems) {
			rowItems.push(item);
		} else {
			rows.set(
				getWorkspaceItemOrderScopeKey({
					workspaceId,
					parentId: item.parentId,
					row: getWorkspaceItemOrderRow(item),
				}),
				[item],
			);
		}
	}

	return new Map(
		Array.from(rows, ([orderScopeKey, rowItems]) => [
			orderScopeKey,
			rowItems
				.slice()
				.sort(compareWorkspaceItemsByOrder)
				.map((item) => item.id),
		]),
	);
}

export function compareWorkspaceItemsByOrder(
	left: Pick<WorkspaceItemSummary, "name" | "sortOrder">,
	right: Pick<WorkspaceItemSummary, "name" | "sortOrder">,
) {
	const orderDelta = left.sortOrder - right.sortOrder;

	if (orderDelta !== 0) {
		return orderDelta;
	}

	return left.name.localeCompare(right.name);
}

export function mergeWorkspaceItemOrder(
	overrideItemIds: string[],
	currentItemIds: string[],
) {
	const currentIds = new Set(currentItemIds);
	const orderedItemIds = overrideItemIds.filter((itemId) =>
		currentIds.has(itemId),
	);
	const orderedIds = new Set(orderedItemIds);

	for (const itemId of currentItemIds) {
		if (!orderedIds.has(itemId)) {
			orderedItemIds.push(itemId);
		}
	}

	return orderedItemIds;
}

export function arraysEqual(left: string[], right: string[]) {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

export function haveSameIds(left: string[], right: string[]) {
	if (left.length !== right.length) {
		return false;
	}

	const rightIds = new Set(right);

	return left.every((itemId) => rightIds.has(itemId));
}
