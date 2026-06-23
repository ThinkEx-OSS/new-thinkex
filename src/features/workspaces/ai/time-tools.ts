import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

const emptyToolInputExamples = [{ input: {} }];
const timeCalculateRelativeInputExamples = [
	{
		input: {
			days_ago: 7,
		},
	},
];

function createRelativeOffsetFieldSchema(description: string) {
	return z.number().int().min(0).optional().describe(description);
}

const timeRelativeOffsetInputSchema = z.object({
	days_ago: createRelativeOffsetFieldSchema("Days to subtract from now."),
	months_ago: createRelativeOffsetFieldSchema(
		"Calendar months to subtract from now.",
	),
	weeks_ago: createRelativeOffsetFieldSchema("Weeks to subtract from now."),
	years_ago: createRelativeOffsetFieldSchema(
		"Calendar years to subtract from now.",
	),
});

const timeRelativeOffsetOutputSchema = timeRelativeOffsetInputSchema.required();

const timePointOutputSchema = z.object({
	timestampSeconds: z.number().int().nonnegative(),
	timestampMilliseconds: z.number().int().nonnegative(),
	isoUtc: z.string(),
	timeZone: z.literal("UTC"),
});

const timeCalculateRelativeOutputSchema = z.object({
	current: timePointOutputSchema,
	calculated: timePointOutputSchema,
	offset: timeRelativeOffsetOutputSchema,
});

export function createAIThreadTimeTools(): ToolSet {
	return {
		time_get_current: tool({
			description:
				"Return the current UTC time as ISO 8601 plus Unix timestamps.",
			inputSchema: z.object({}),
			inputExamples: emptyToolInputExamples,
			outputSchema: timePointOutputSchema,
			strict: true,
			execute: async () => formatTimeToolResult(new Date()),
		}),
		time_calculate_relative: tool({
			description:
				"Return a past UTC time relative to now. Use for date filters like yesterday, last week, or 3 months ago.",
			inputSchema: timeRelativeOffsetInputSchema,
			inputExamples: timeCalculateRelativeInputExamples,
			outputSchema: timeCalculateRelativeOutputSchema,
			strict: true,
			execute: async (input) => {
				const offset = normalizeRelativeOffset(input);
				const current = new Date();
				const calculated = subtractRelativeUtcDate(current, offset);

				return {
					current: formatTimeToolResult(current),
					calculated: formatTimeToolResult(calculated),
					offset,
				};
			},
		}),
	};
}

function formatTimeToolResult(date: Date) {
	return {
		timestampSeconds: Math.floor(date.getTime() / 1000),
		timestampMilliseconds: date.getTime(),
		isoUtc: date.toISOString(),
		timeZone: "UTC",
	};
}

function normalizeRelativeOffset(
	input: z.input<typeof timeRelativeOffsetInputSchema>,
) {
	return {
		days_ago: input.days_ago ?? 0,
		months_ago: input.months_ago ?? 0,
		weeks_ago: input.weeks_ago ?? 0,
		years_ago: input.years_ago ?? 0,
	};
}

function subtractRelativeUtcDate(
	date: Date,
	input: z.output<typeof timeRelativeOffsetOutputSchema>,
) {
	const calendarAdjusted = subtractUtcCalendarMonthsAndYears(
		date,
		input.months_ago,
		input.years_ago,
	);
	const days = input.days_ago + input.weeks_ago * 7;

	return new Date(calendarAdjusted.getTime() - days * 24 * 60 * 60 * 1000);
}

function subtractUtcCalendarMonthsAndYears(
	date: Date,
	monthsAgo: number,
	yearsAgo: number,
) {
	const targetMonthStart = new Date(
		Date.UTC(
			date.getUTCFullYear() - yearsAgo,
			date.getUTCMonth() - monthsAgo,
			1,
			date.getUTCHours(),
			date.getUTCMinutes(),
			date.getUTCSeconds(),
			date.getUTCMilliseconds(),
		),
	);
	const lastTargetMonthDay = new Date(
		Date.UTC(
			targetMonthStart.getUTCFullYear(),
			targetMonthStart.getUTCMonth() + 1,
			0,
		),
	).getUTCDate();
	const targetDay = Math.min(date.getUTCDate(), lastTargetMonthDay);

	return new Date(
		Date.UTC(
			targetMonthStart.getUTCFullYear(),
			targetMonthStart.getUTCMonth(),
			targetDay,
			date.getUTCHours(),
			date.getUTCMinutes(),
			date.getUTCSeconds(),
			date.getUTCMilliseconds(),
		),
	);
}
