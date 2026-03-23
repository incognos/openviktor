import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface NotionConfig {
	apiToken: string;
	defaultDatabaseId?: string;
}

async function notionFetch(
	config: NotionConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`https://api.notion.com/v1${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${config.apiToken}`,
			"Content-Type": "application/json",
			"Notion-Version": "2022-06-28",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	let data: unknown;
	try { data = await res.json(); } catch { data = null; }
	return { ok: res.ok, status: res.status, data };
}

function extractRichText(rt: unknown): string {
	if (!Array.isArray(rt)) return "";
	return rt.map((t: Record<string, unknown>) => (t.plain_text as string) ?? "").join("");
}

// ─── notion_search ────────────────────────────────────────────────────────────

export const notionSearchDefinition: LLMToolDefinition = {
	name: "notion_search",
	description: "Search Notion pages and databases by title.",
	input_schema: {
		type: "object",
		properties: {
			query: { type: "string", description: "Search query" },
			filter_type: { type: "string", enum: ["page", "database"], description: "Filter by object type (optional)" },
		},
		required: ["query"],
	},
};

export function createNotionSearchExecutor(config: NotionConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const body: Record<string, unknown> = { query: args.query as string };
		if (args.filter_type) body.filter = { value: args.filter_type, property: "object" };
		const r = await notionFetch(config, "/search", "POST", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Notion ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const results = (d.results as Array<Record<string, unknown>>).slice(0, 10).map((obj) => ({
			id: obj.id,
			type: obj.object,
			title: obj.object === "page"
				? extractRichText((obj.properties as Record<string, Record<string, unknown>>)?.title?.title ?? (obj.properties as Record<string, Record<string, unknown>>)?.Name?.title ?? [])
				: extractRichText((obj as Record<string, unknown>).title as unknown[]),
			url: obj.url,
			last_edited: obj.last_edited_time,
		}));
		return { output: { results, total: (d.results as unknown[]).length }, durationMs: 0 };
	};
}

// ─── notion_get_page ─────────────────────────────────────────────────────────

export const notionGetPageDefinition: LLMToolDefinition = {
	name: "notion_get_page",
	description: "Get a Notion page's properties and content blocks.",
	input_schema: {
		type: "object",
		properties: {
			page_id: { type: "string", description: "Notion page ID" },
		},
		required: ["page_id"],
	},
};

export function createNotionGetPageExecutor(config: NotionConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = args.page_id as string;
		const [pageRes, blocksRes] = await Promise.all([
			notionFetch(config, `/pages/${id}`),
			notionFetch(config, `/blocks/${id}/children?page_size=50`),
		]);
		if (!pageRes.ok) return { output: null, durationMs: 0, error: `Notion ${pageRes.status}: ${JSON.stringify(pageRes.data)}` };
		const page = pageRes.data as Record<string, unknown>;
		const blocks = blocksRes.ok ? (blocksRes.data as Record<string, unknown>).results as Array<Record<string, unknown>> : [];
		const content = blocks.map((b) => {
			const type = b.type as string;
			const block = b[type] as Record<string, unknown> | undefined;
			const text = block?.rich_text ? extractRichText(block.rich_text) : "";
			return `[${type}] ${text}`;
		}).filter(Boolean).join("\n");
		return {
			output: {
				id: page.id,
				url: page.url,
				created: page.created_time,
				last_edited: page.last_edited_time,
				content,
			},
			durationMs: 0,
		};
	};
}

// ─── notion_create_page ───────────────────────────────────────────────────────

export const notionCreatePageDefinition: LLMToolDefinition = {
	name: "notion_create_page",
	description: "Create a new page in a Notion database.",
	input_schema: {
		type: "object",
		properties: {
			database_id: { type: "string", description: "Notion database ID (uses default if not provided)" },
			title: { type: "string", description: "Page title" },
			content: { type: "string", description: "Page body content (plain text)" },
		},
		required: ["title"],
	},
};

export function createNotionCreatePageExecutor(config: NotionConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const dbId = (args.database_id as string | undefined) ?? config.defaultDatabaseId;
		if (!dbId) return { output: null, durationMs: 0, error: "No database_id provided and no default configured" };
		const body: Record<string, unknown> = {
			parent: { database_id: dbId },
			properties: {
				title: { title: [{ text: { content: args.title as string } }] },
			},
		};
		if (args.content) {
			body.children = [{
				object: "block",
				type: "paragraph",
				paragraph: { rich_text: [{ type: "text", text: { content: args.content as string } }] },
			}];
		}
		const r = await notionFetch(config, "/pages", "POST", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Notion ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		return { output: { success: true, id: d.id, url: d.url }, durationMs: 0 };
	};
}

// ─── notion_query_database ────────────────────────────────────────────────────

export const notionQueryDatabaseDefinition: LLMToolDefinition = {
	name: "notion_query_database",
	description: "Query a Notion database and return its entries.",
	input_schema: {
		type: "object",
		properties: {
			database_id: { type: "string", description: "Notion database ID (uses default if not provided)" },
			filter_property: { type: "string", description: "Property name to filter by (optional)" },
			filter_value: { type: "string", description: "Value to filter for (optional)" },
			max_results: { type: "number", description: "Max results (default 20)" },
		},
		required: [],
	},
};

export function createNotionQueryDatabaseExecutor(config: NotionConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const dbId = (args.database_id as string | undefined) ?? config.defaultDatabaseId;
		if (!dbId) return { output: null, durationMs: 0, error: "No database_id provided and no default configured" };
		const body: Record<string, unknown> = { page_size: (args.max_results as number | undefined) ?? 20 };
		const r = await notionFetch(config, `/databases/${dbId}/query`, "POST", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Notion ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const pages = (d.results as Array<Record<string, unknown>>).map((p) => {
			const props = p.properties as Record<string, Record<string, unknown>>;
			const titleProp = Object.values(props).find((v) => v.type === "title");
			const title = titleProp ? extractRichText(titleProp.title as unknown[]) : "(untitled)";
			return { id: p.id, title, url: p.url, last_edited: p.last_edited_time };
		});
		return { output: { pages, has_more: d.has_more }, durationMs: 0 };
	};
}
