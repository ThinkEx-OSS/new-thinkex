import { normalizeWorkspaceItemName } from "#/features/workspaces/defaults.ts";

export function deduplicateSiblingNames(
	items: Array<{ name: string; parentId: string | null }>,
): Array<{ name: string; parentId: string | null; originalName: string; renamed: boolean }> {
	const seen = new Map<string, Set<string>>();

	return items.map((item) => {
		const parentKey = item.parentId ?? "__root__";
		let nameSet = seen.get(parentKey);

		if (!nameSet) {
			nameSet = new Set();
			seen.set(parentKey, nameSet);
		}

		const normalized = normalizeWorkspaceItemName(item.name);

		if (!nameSet.has(normalized)) {
			nameSet.add(normalized);
			return { name: normalized, parentId: item.parentId, originalName: item.name, renamed: false };
		}

		for (let suffix = 2; suffix < 10000; suffix++) {
			const candidate = normalizeWorkspaceItemName(`${normalized} ${suffix}`);

			if (!nameSet.has(candidate)) {
				nameSet.add(candidate);
				return {
					name: candidate,
					parentId: item.parentId,
					originalName: item.name,
					renamed: true,
				};
			}
		}

		const fallback = normalizeWorkspaceItemName(
			`${normalized} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		);
		nameSet.add(fallback);
		return { name: fallback, parentId: item.parentId, originalName: item.name, renamed: true };
	});
}
