import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface PlausibleConfig {
	apiKey: string;
	defaultSiteId?: string;
}

async function plausibleQuery(
	config: PlausibleConfig,
	body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch("https://plausible.io/api/v2/query", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	let data: unknown;
	try {
		data = await res.json();
	} catch {
		data = null;
	}
	return { ok: res.ok, status: res.status, data };
}

function siteId(config: PlausibleConfig, args: Record<string, unknown>): string {
	return (args.site_id as string | undefined) ?? config.defaultSiteId ?? "";
}

// ─── plausible_get_stats ──────────────────────────────────────────────────────

export const plausibleGetStatsDefinition: LLMToolDefinition = {
	name: "plausible_get_stats",
	description:
		"Get key website metrics from Plausible Analytics (visitors, pageviews, bounce rate, visit duration).",
	input_schema: {
		type: "object",
		properties: {
			site_id: {
				type: "string",
				description: "Domain as registered in Plausible (uses default if not provided)",
			},
			date_range: {
				type: "string",
				enum: ["day", "7d", "30d", "month", "6mo", "12mo", "year"],
				description: "Time period to query (default: 7d)",
			},
		},
		required: [],
	},
};

export function createPlausibleGetStatsExecutor(config: PlausibleConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const site = siteId(config, args);
		if (!site) return { output: null, durationMs: 0, error: "No site_id provided and no default configured" };
		const r = await plausibleQuery(config, {
			site_id: site,
			date_range: (args.date_range as string | undefined) ?? "7d",
			metrics: ["visitors", "visits", "pageviews", "bounce_rate", "visit_duration"],
		});
		if (!r.ok) return { output: null, durationMs: 0, error: `Plausible ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const results = (d.results as Array<Record<string, unknown>>) ?? [];
		const row = results[0]?.metrics as number[] | undefined;
		return {
			output: {
				site_id: site,
				date_range: (args.date_range as string | undefined) ?? "7d",
				visitors: row?.[0] ?? 0,
				visits: row?.[1] ?? 0,
				pageviews: row?.[2] ?? 0,
				bounce_rate: row?.[3] ?? 0,
				visit_duration_seconds: row?.[4] ?? 0,
			},
			durationMs: 0,
		};
	};
}

// ─── plausible_top_pages ──────────────────────────────────────────────────────

export const plausibleTopPagesDefinition: LLMToolDefinition = {
	name: "plausible_top_pages",
	description: "Get the top pages by visitors for a Plausible site.",
	input_schema: {
		type: "object",
		properties: {
			site_id: { type: "string", description: "Domain as registered in Plausible" },
			date_range: {
				type: "string",
				enum: ["day", "7d", "30d", "month", "6mo", "12mo", "year"],
				description: "Time period (default: 7d)",
			},
			limit: { type: "number", description: "Max results (default: 10)" },
		},
		required: [],
	},
};

export function createPlausibleTopPagesExecutor(config: PlausibleConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const site = siteId(config, args);
		if (!site) return { output: null, durationMs: 0, error: "No site_id provided and no default configured" };
		const r = await plausibleQuery(config, {
			site_id: site,
			date_range: (args.date_range as string | undefined) ?? "7d",
			metrics: ["visitors", "pageviews"],
			dimensions: ["event:page"],
			order_by: [["visitors", "desc"]],
			pagination: { limit: (args.limit as number | undefined) ?? 10 },
		});
		if (!r.ok) return { output: null, durationMs: 0, error: `Plausible ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const pages = ((d.results as Array<Record<string, unknown>>) ?? []).map((row) => ({
			page: (row.dimensions as string[])?.[0],
			visitors: (row.metrics as number[])?.[0],
			pageviews: (row.metrics as number[])?.[1],
		}));
		return { output: { site_id: site, pages }, durationMs: 0 };
	};
}

// ─── plausible_top_sources ────────────────────────────────────────────────────

export const plausibleTopSourcesDefinition: LLMToolDefinition = {
	name: "plausible_top_sources",
	description: "Get the top traffic sources (referrers) for a Plausible site.",
	input_schema: {
		type: "object",
		properties: {
			site_id: { type: "string", description: "Domain as registered in Plausible" },
			date_range: {
				type: "string",
				enum: ["day", "7d", "30d", "month", "6mo", "12mo", "year"],
				description: "Time period (default: 7d)",
			},
			limit: { type: "number", description: "Max results (default: 10)" },
		},
		required: [],
	},
};

export function createPlausibleTopSourcesExecutor(config: PlausibleConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const site = siteId(config, args);
		if (!site) return { output: null, durationMs: 0, error: "No site_id provided and no default configured" };
		const r = await plausibleQuery(config, {
			site_id: site,
			date_range: (args.date_range as string | undefined) ?? "7d",
			metrics: ["visitors"],
			dimensions: ["visit:source"],
			order_by: [["visitors", "desc"]],
			pagination: { limit: (args.limit as number | undefined) ?? 10 },
		});
		if (!r.ok) return { output: null, durationMs: 0, error: `Plausible ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const sources = ((d.results as Array<Record<string, unknown>>) ?? []).map((row) => ({
			source: (row.dimensions as string[])?.[0],
			visitors: (row.metrics as number[])?.[0],
		}));
		return { output: { site_id: site, sources }, durationMs: 0 };
	};
}

// ─── plausible_realtime ───────────────────────────────────────────────────────

export const plausibleRealtimeDefinition: LLMToolDefinition = {
	name: "plausible_realtime",
	description: "Get the number of active visitors on a Plausible site right now (last 5 minutes).",
	input_schema: {
		type: "object",
		properties: {
			site_id: { type: "string", description: "Domain as registered in Plausible" },
		},
		required: [],
	},
};

export function createPlausibleRealtimeExecutor(config: PlausibleConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const site = siteId(config, args);
		if (!site) return { output: null, durationMs: 0, error: "No site_id provided and no default configured" };
		const res = await fetch(
			`https://plausible.io/api/v1/stats/realtime/visitors?site_id=${encodeURIComponent(site)}`,
			{ headers: { Authorization: `Bearer ${config.apiKey}` } },
		);
		let data: unknown;
		try {
			data = await res.json();
		} catch {
			data = null;
		}
		if (!res.ok) return { output: null, durationMs: 0, error: `Plausible ${res.status}: ${JSON.stringify(data)}` };
		return { output: { site_id: site, active_visitors: data }, durationMs: 0 };
	};
}

// ─── plausible_breakdown ──────────────────────────────────────────────────────

export const plausibleBreakdownDefinition: LLMToolDefinition = {
	name: "plausible_breakdown",
	description:
		"Break down Plausible stats by any dimension: country, device, browser, OS, UTM campaign, etc.",
	input_schema: {
		type: "object",
		properties: {
			site_id: { type: "string", description: "Domain as registered in Plausible" },
			dimension: {
				type: "string",
				description:
					"Dimension to break down by e.g. visit:country, visit:device, visit:browser, visit:os, visit:utm_campaign, event:page",
			},
			date_range: {
				type: "string",
				enum: ["day", "7d", "30d", "month", "6mo", "12mo", "year"],
				description: "Time period (default: 7d)",
			},
			limit: { type: "number", description: "Max results (default: 10)" },
		},
		required: ["dimension"],
	},
};

export function createPlausibleBreakdownExecutor(config: PlausibleConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const site = siteId(config, args);
		if (!site) return { output: null, durationMs: 0, error: "No site_id provided and no default configured" };
		const r = await plausibleQuery(config, {
			site_id: site,
			date_range: (args.date_range as string | undefined) ?? "7d",
			metrics: ["visitors", "pageviews"],
			dimensions: [args.dimension],
			order_by: [["visitors", "desc"]],
			pagination: { limit: (args.limit as number | undefined) ?? 10 },
		});
		if (!r.ok) return { output: null, durationMs: 0, error: `Plausible ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const rows = ((d.results as Array<Record<string, unknown>>) ?? []).map((row) => ({
			[args.dimension as string]: (row.dimensions as string[])?.[0],
			visitors: (row.metrics as number[])?.[0],
			pageviews: (row.metrics as number[])?.[1],
		}));
		return { output: { site_id: site, dimension: args.dimension, rows }, durationMs: 0 };
	};
}
