import { describe, expect, it } from "vitest";

import {
	canGrantRole,
	canManageMember,
	getDefaultInviteRole,
	getGrantableInviteRoles,
	isInviteExpired,
	resolveRoleAfterAccept,
} from "#/features/workspaces/invites/workspace-invite-rules";

describe("canGrantRole", () => {
	it("enforces invite-down for editors", () => {
		expect(canGrantRole("editor", "editor")).toBe(true);
		expect(canGrantRole("editor", "viewer")).toBe(true);
		expect(canGrantRole("editor", "admin")).toBe(false);
	});

	it("blocks granting owner through normal invite", () => {
		expect(canGrantRole("owner", "owner")).toBe(false);
	});

	it("allows admins to grant admin", () => {
		expect(canGrantRole("admin", "admin")).toBe(true);
	});

	it("limits viewers to viewer invites", () => {
		expect(canGrantRole("viewer", "viewer")).toBe(true);
		expect(canGrantRole("viewer", "editor")).toBe(false);
	});
});

describe("resolveRoleAfterAccept", () => {
	it("upgrades viewers to editors", () => {
		expect(resolveRoleAfterAccept("viewer", "editor")).toBe("editor");
	});

	it("does not demote editors to viewers", () => {
		expect(resolveRoleAfterAccept("editor", "viewer")).toBe("editor");
	});
});

describe("canManageMember", () => {
	it("lets owners manage non-owners", () => {
		expect(canManageMember("owner", "admin")).toBe(true);
		expect(canManageMember("owner", "owner")).toBe(false);
	});

	it("lets admins manage editors and viewers only", () => {
		expect(canManageMember("admin", "editor")).toBe(true);
		expect(canManageMember("admin", "admin")).toBe(false);
	});
});

describe("isInviteExpired", () => {
	it("returns false when no expiry is set", () => {
		expect(isInviteExpired(null)).toBe(false);
	});

	it("returns true when expiry is in the past", () => {
		expect(isInviteExpired(new Date("2020-01-01T00:00:00Z"))).toBe(true);
	});
});

describe("getGrantableInviteRoles", () => {
	it("returns editor and viewer for editors", () => {
		expect(getGrantableInviteRoles("editor")).toEqual(["editor", "viewer"]);
	});
});

describe("getDefaultInviteRole", () => {
	it("defaults editors to editor links", () => {
		expect(getDefaultInviteRole("editor")).toBe("editor");
	});

	it("defaults viewers to viewer links", () => {
		expect(getDefaultInviteRole("viewer")).toBe("viewer");
	});
});
