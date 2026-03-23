import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface ShortcutConfig {
	apiToken: string;
	defaultWorkflowId?: number;
}

const BASE = "https://api.app.shortcut.com/api/v3";

async function scFetch(
	config: ShortcutConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			"Shortcut-Token": config.apiToken,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	let data: unknown;
	try { data = await res.json(); } catch { data = null; }
	return { ok: res.ok, status: res.status, data };
}

// ─── shortcut_get_story ───────────────────────────────────────────────────────

export const shortcutGetStoryDefinition: LLMToolDefinition = {
	name: "shortcut_get_story",
	description: "Get details of a Shortcut story by ID (sc-XXXX or just the number).",
	input_schema: {
		type: "object",
		properties: {
			story_id: { type: "string", description: "Story ID e.g. sc-1234 or 1234" },
		},
		required: ["story_id"],
	},
};

export function createShortcutGetStoryExecutor(config: ShortcutConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = String(args.story_id).replace(/^sc-/i, "");
		const r = await scFetch(config, `/stories/${id}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Shortcut ${r.status}: ${JSON.stringify(r.data)}` };
		const s = r.data as Record<string, unknown>;
		return {
			output: {
				id: s.id, name: s.name, story_type: s.story_type,
				description: s.description, estimate: s.estimate,
				workflow_state_id: s.workflow_state_id,
				epic_id: s.epic_id,
				labels: (s.labels as Array<Record<string, unknown>>)?.map((l) => l.name) ?? [],
				url: s.app_url,
			},
			durationMs: 0,
		};
	};
}

// ─── shortcut_search_stories ──────────────────────────────────────────────────

export const shortcutSearchStoriesDefinition: LLMToolDefinition = {
	name: "shortcut_search_stories",
	description: "Search Shortcut stories by keyword, assignee, state, or label.",
	input_schema: {
		type: "object",
		properties: {
			query: { type: "string", description: "Search query (Shortcut search syntax supported)" },
			limit: { type: "number", description: "Max results (default 20)" },
		},
		required: ["query"],
	},
};

export function createShortcutSearchStoriesExecutor(config: ShortcutConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const limit = (args.limit as number | undefined) ?? 20;
		const r = await scFetch(config, `/search/stories?query=${encodeURIComponent(args.query as string)}&page_size=${limit}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Shortcut ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const stories = ((d.data as Array<Record<string, unknown>>) ?? []).map((s) => ({
			id: s.id, name: s.name, story_type: s.story_type,
			estimate: s.estimate, workflow_state_id: s.workflow_state_id,
			url: s.app_url,
		}));
		return { output: { stories, total: d.total }, durationMs: 0 };
	};
}

// ─── shortcut_create_story ────────────────────────────────────────────────────

export const shortcutCreateStoryDefinition: LLMToolDefinition = {
	name: "shortcut_create_story",
	description: "Create a new Shortcut story (feature, bug, or chore).",
	input_schema: {
		type: "object",
		properties: {
			name: { type: "string", description: "Story title" },
			description: { type: "string", description: "Story description (markdown)" },
			story_type: { type: "string", enum: ["feature", "bug", "chore"], description: "Story type" },
			workflow_state_id: { type: "number", description: "Workflow state ID (use shortcut_list_workflows to get IDs)" },
			epic_id: { type: "number", description: "Epic ID to add the story to (optional)" },
			estimate: { type: "number", description: "Story point estimate (optional)" },
			labels: { type: "array", items: { type: "string" }, description: "Label names (optional)" },
		},
		required: ["name", "story_type"],
	},
};

export function createShortcutCreateStoryExecutor(config: ShortcutConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const body: Record<string, unknown> = {
			name: args.name,
			story_type: args.story_type,
		};
		if (args.description) body.description = args.description;
		if (args.workflow_state_id) body.workflow_state_id = args.workflow_state_id;
		if (args.epic_id) body.epic_id = args.epic_id;
		if (args.estimate) body.estimate = args.estimate;
		if (args.labels) body.labels = (args.labels as string[]).map((name) => ({ name }));
		const r = await scFetch(config, "/stories", "POST", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Shortcut ${r.status}: ${JSON.stringify(r.data)}` };
		const s = r.data as Record<string, unknown>;
		return { output: { success: true, id: s.id, name: s.name, url: s.app_url }, durationMs: 0 };
	};
}

// ─── shortcut_update_story ────────────────────────────────────────────────────

export const shortcutUpdateStoryDefinition: LLMToolDefinition = {
	name: "shortcut_update_story",
	description: "Update a Shortcut story (state, estimate, title, description, etc.).",
	input_schema: {
		type: "object",
		properties: {
			story_id: { type: "string", description: "Story ID e.g. sc-1234 or 1234" },
			name: { type: "string", description: "New title (optional)" },
			description: { type: "string", description: "New description (optional)" },
			workflow_state_id: { type: "number", description: "New workflow state ID (optional)" },
			estimate: { type: "number", description: "New estimate (optional)" },
			epic_id: { type: "number", description: "New epic ID (optional)" },
		},
		required: ["story_id"],
	},
};

export function createShortcutUpdateStoryExecutor(config: ShortcutConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = String(args.story_id).replace(/^sc-/i, "");
		const body: Record<string, unknown> = {};
		if (args.name) body.name = args.name;
		if (args.description) body.description = args.description;
		if (args.workflow_state_id) body.workflow_state_id = args.workflow_state_id;
		if (args.estimate !== undefined) body.estimate = args.estimate;
		if (args.epic_id) body.epic_id = args.epic_id;
		const r = await scFetch(config, `/stories/${id}`, "PUT", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Shortcut ${r.status}: ${JSON.stringify(r.data)}` };
		const s = r.data as Record<string, unknown>;
		return { output: { success: true, id: s.id, name: s.name, workflow_state_id: s.workflow_state_id, url: s.app_url }, durationMs: 0 };
	};
}

// ─── shortcut_add_comment ─────────────────────────────────────────────────────

export const shortcutAddCommentDefinition: LLMToolDefinition = {
	name: "shortcut_add_comment",
	description: "Add a comment to a Shortcut story.",
	input_schema: {
		type: "object",
		properties: {
			story_id: { type: "string", description: "Story ID e.g. sc-1234 or 1234" },
			text: { type: "string", description: "Comment text (markdown supported)" },
		},
		required: ["story_id", "text"],
	},
};

export function createShortcutAddCommentExecutor(config: ShortcutConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = String(args.story_id).replace(/^sc-/i, "");
		const r = await scFetch(config, `/stories/${id}/comments`, "POST", { text: args.text });
		if (!r.ok) return { output: null, durationMs: 0, error: `Shortcut ${r.status}: ${JSON.stringify(r.data)}` };
		const c = r.data as Record<string, unknown>;
		return { output: { success: true, comment_id: c.id, story_id: id }, durationMs: 0 };
	};
}

// ─── shortcut_list_workflows ──────────────────────────────────────────────────

export const shortcutListWorkflowsDefinition: LLMToolDefinition = {
	name: "shortcut_list_workflows",
	description: "List all Shortcut workflows and their state IDs. Use this to get workflow_state_id values.",
	input_schema: { type: "object", properties: {}, required: [] },
};

export function createShortcutListWorkflowsExecutor(config: ShortcutConfig): ToolExecutor {
	return async (): Promise<ToolResult> => {
		const r = await scFetch(config, "/workflows");
		if (!r.ok) return { output: null, durationMs: 0, error: `Shortcut ${r.status}: ${JSON.stringify(r.data)}` };
		const workflows = (r.data as Array<Record<string, unknown>>).map((w) => ({
			id: w.id, name: w.name,
			states: (w.states as Array<Record<string, unknown>>).map((s) => ({ id: s.id, name: s.name, type: s.type })),
		}));
		return { output: { workflows }, durationMs: 0 };
	};
}

// ─── shortcut_list_epics ──────────────────────────────────────────────────────

export const shortcutListEpicsDefinition: LLMToolDefinition = {
	name: "shortcut_list_epics",
	description: "List all Shortcut epics.",
	input_schema: { type: "object", properties: {}, required: [] },
};

export function createShortcutListEpicsExecutor(config: ShortcutConfig): ToolExecutor {
	return async (): Promise<ToolResult> => {
		const r = await scFetch(config, "/epics");
		if (!r.ok) return { output: null, durationMs: 0, error: `Shortcut ${r.status}: ${JSON.stringify(r.data)}` };
		const epics = (r.data as Array<Record<string, unknown>>).map((e) => ({
			id: e.id, name: e.name, state: e.state,
			total_stories: (e.stats as Record<string, unknown>)?.num_stories_total ?? 0,
			url: e.app_url,
		}));
		return { output: { epics }, durationMs: 0 };
	};
}
