import assert from "node:assert/strict";
import test from "node:test";

import { getNextModeToggleTheme } from "#/components/mode-toggle";

void test("getNextModeToggleTheme switches from explicit dark mode back to light", () => {
	assert.equal(getNextModeToggleTheme("dark", "dark"), "light");
});

void test("getNextModeToggleTheme switches from system-dark rendering to light on the first click", () => {
	assert.equal(getNextModeToggleTheme("system", "dark"), "light");
});
