import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface PipedriveConfig {
	apiToken: string;
	companyDomain: string;
}

async function pdFetch(
	config: PipedriveConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const sep = path.includes("?") ? "&" : "?";
	const res = await fetch(`https://${config.companyDomain}.pipedrive.com/api/v1${path}${sep}api_token=${config.apiToken}`, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	let data: unknown;
	try { data = await res.json(); } catch { data = null; }
	return { ok: res.ok, status: res.status, data };
}

// ─── pipedrive_search_deals ───────────────────────────────────────────────────

export const pipedriveSearchDealsDefinition: LLMToolDefinition = {
	name: "pipedrive_search_deals",
	description: "Search for deals in Pipedrive by title or person name.",
	input_schema: {
		type: "object",
		properties: {
			query: { type: "string", description: "Search term" },
			status: { type: "string", enum: ["open", "won", "lost", "all_not_deleted"], description: "Deal status filter (default: open)" },
			limit: { type: "number", description: "Max results (default 20)" },
		},
		required: ["query"],
	},
};

export function createPipedriveSearchDealsExecutor(config: PipedriveConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const status = (args.status as string | undefined) ?? "open";
		const limit = (args.limit as number | undefined) ?? 20;
		const r = await pdFetch(config, `/deals/search?term=${encodeURIComponent(args.query as string)}&status=${status}&limit=${limit}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Pipedrive ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const items = ((d.data as Record<string, unknown>)?.items as Array<Record<string, unknown>>) ?? [];
		const deals = items.map((i) => {
			const deal = i.item as Record<string, unknown>;
			return {
				id: deal.id, title: deal.title, value: deal.value, currency: deal.currency,
				status: deal.status, stage: (deal.stage as Record<string, unknown>)?.name,
				person: (deal.person as Record<string, unknown>)?.name,
				org: (deal.organization as Record<string, unknown>)?.name,
			};
		});
		return { output: { deals, count: deals.length }, durationMs: 0 };
	};
}

// ─── pipedrive_get_deal ───────────────────────────────────────────────────────

export const pipedriveGetDealDefinition: LLMToolDefinition = {
	name: "pipedrive_get_deal",
	description: "Get full details of a Pipedrive deal by ID.",
	input_schema: {
		type: "object",
		properties: {
			deal_id: { type: "number", description: "Pipedrive deal ID" },
		},
		required: ["deal_id"],
	},
};

export function createPipedriveGetDealExecutor(config: PipedriveConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const r = await pdFetch(config, `/deals/${args.deal_id}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Pipedrive ${r.status}: ${JSON.stringify(r.data)}` };
		const d = (r.data as Record<string, unknown>).data as Record<string, unknown>;
		return {
			output: {
				id: d.id, title: d.title, value: d.value, currency: d.currency,
				status: d.status, probability: d.probability,
				stage: (d.stage_id as number),
				person: (d.person_id as Record<string, unknown>)?.name,
				org: (d.org_id as Record<string, unknown>)?.name,
				expected_close: d.expected_close_date,
				add_time: d.add_time, update_time: d.update_time,
			},
			durationMs: 0,
		};
	};
}

// ─── pipedrive_create_note ────────────────────────────────────────────────────

export const pipedriveCreateNoteDefinition: LLMToolDefinition = {
	name: "pipedrive_create_note",
	description: "Add a note to a Pipedrive deal, person, or organization.",
	input_schema: {
		type: "object",
		properties: {
			content: { type: "string", description: "Note content" },
			deal_id: { type: "number", description: "Deal ID to attach to (optional)" },
			person_id: { type: "number", description: "Person ID to attach to (optional)" },
			org_id: { type: "number", description: "Organization ID to attach to (optional)" },
		},
		required: ["content"],
	},
};

export function createPipedriveCreateNoteExecutor(config: PipedriveConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const body: Record<string, unknown> = { content: args.content };
		if (args.deal_id) body.deal_id = args.deal_id;
		if (args.person_id) body.person_id = args.person_id;
		if (args.org_id) body.org_id = args.org_id;
		const r = await pdFetch(config, "/notes", "POST", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Pipedrive ${r.status}: ${JSON.stringify(r.data)}` };
		const d = (r.data as Record<string, unknown>).data as Record<string, unknown>;
		return { output: { success: true, note_id: d.id }, durationMs: 0 };
	};
}

// ─── pipedrive_list_activities ────────────────────────────────────────────────

export const pipedriveListActivitiesDefinition: LLMToolDefinition = {
	name: "pipedrive_list_activities",
	description: "List upcoming or recent activities in Pipedrive.",
	input_schema: {
		type: "object",
		properties: {
			done: { type: "boolean", description: "Show completed activities (default: false = upcoming)" },
			limit: { type: "number", description: "Max results (default 20)" },
		},
		required: [],
	},
};

export function createPipedriveListActivitiesExecutor(config: PipedriveConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const done = (args.done as boolean | undefined) ? 1 : 0;
		const limit = (args.limit as number | undefined) ?? 20;
		const r = await pdFetch(config, `/activities?done=${done}&limit=${limit}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Pipedrive ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const activities = ((d.data as Array<Record<string, unknown>>) ?? []).map((a) => ({
			id: a.id, type: a.type, subject: a.subject, due_date: a.due_date,
			done: a.done, deal: (a.deal_id as Record<string, unknown>)?.title,
			person: (a.person_id as Record<string, unknown>)?.name,
		}));
		return { output: { activities, count: activities.length }, durationMs: 0 };
	};
}
