export const userAIAgentName = "UserAIStore";
export const aiThreadAgentName = "AIThread";
export const userAIPathPrefix = "/user-ai";
export const userAIBasePath = "user-ai";

export const workspaceKernelAgentName = "WorkspaceKernel";
export const workspaceKernelPathPrefix = "/workspace-kernel";
export const workspaceKernelBasePath = "workspace-kernel";
export const workspaceKernelRealtimeSegment = "realtime";

export function isUserAIRequestPath(pathname: string) {
	return matchesPathPrefix(pathname, userAIPathPrefix);
}

export function isWorkspaceKernelRequestPath(pathname: string) {
	return pathname.startsWith(`${workspaceKernelPathPrefix}/`);
}

export function getWorkspaceKernelRouteWorkspaceId(pathname: string) {
	if (!isWorkspaceKernelRequestPath(pathname)) {
		return null;
	}

	const [workspaceId] = pathname
		.slice(workspaceKernelPathPrefix.length + 1)
		.split("/");

	return workspaceId || null;
}

export function getWorkspaceKernelRealtimePath(workspaceId: string) {
	return `${workspaceId}/${workspaceKernelRealtimeSegment}`;
}

function matchesPathPrefix(pathname: string, pathPrefix: string) {
	return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
}
