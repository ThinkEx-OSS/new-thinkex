import { describe, expect, it } from "vitest";

import {
	apiErrorSchema,
	workspaceListResponseSchema,
} from "#/lib/api/contracts";
import { listMockWorkspaces } from "#/services/workspaces";

describe("workspace contracts", () => {
	it("returns a valid workspace list shape", () => {
		const payload = {
			workspaces: listMockWorkspaces(),
		};

		expect(workspaceListResponseSchema.parse(payload)).toEqual(payload);
	});

	it("validates the shared API error envelope", () => {
		const payload = {
			requestId: "req_test_123",
			code: "UNAUTHORIZED",
			message: "You must be signed in to view workspaces.",
		};

		expect(apiErrorSchema.parse(payload)).toEqual(payload);
	});
});
