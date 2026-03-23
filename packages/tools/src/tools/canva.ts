import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface CanvaConfig {
	accessToken: string;
}

async function canvaFetch(
	config: CanvaConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`https://api.canva.com/rest/v1${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${config.accessToken}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	let data: unknown;
	try { data = await res.json(); } catch { data = null; }
	return { ok: res.ok, status: res.status, data };
}

// ─── canva_list_designs ───────────────────────────────────────────────────────

export const canvaListDesignsDefinition: LLMToolDefinition = {
	name: "canva_list_designs",
	description: "List recent designs in Canva.",
	input_schema: {
		type: "object",
		properties: {
			query: { type: "string", description: "Search query to filter designs (optional)" },
			limit: { type: "number", description: "Max results (default 20)" },
		},
		required: [],
	},
};

export function createCanvaListDesignsExecutor(config: CanvaConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const limit = (args.limit as number | undefined) ?? 20;
		const q = args.query ? `&query=${encodeURIComponent(args.query as string)}` : "";
		const r = await canvaFetch(config, `/designs?limit=${limit}${q}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Canva ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const items = (d.items as Array<Record<string, unknown>>) ?? [];
		const designs = items.map((i) => ({
			id: i.id,
			title: i.title,
			url: (i.urls as Record<string, unknown>)?.edit_url ?? (i.urls as Record<string, unknown>)?.view_url,
			created: i.created_at,
			updated: i.updated_at,
		}));
		return { output: { designs, count: designs.length }, durationMs: 0 };
	};
}

// ─── canva_get_design ─────────────────────────────────────────────────────────

export const canvaGetDesignDefinition: LLMToolDefinition = {
	name: "canva_get_design",
	description: "Get details of a specific Canva design.",
	input_schema: {
		type: "object",
		properties: {
			design_id: { type: "string", description: "Canva design ID" },
		},
		required: ["design_id"],
	},
};

export function createCanvaGetDesignExecutor(config: CanvaConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const r = await canvaFetch(config, `/designs/${args.design_id}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Canva ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		return {
			output: {
				id: d.id, title: d.title,
				edit_url: (d.urls as Record<string, unknown>)?.edit_url,
				view_url: (d.urls as Record<string, unknown>)?.view_url,
				thumbnail: (d.thumbnail as Record<string, unknown>)?.url,
				created: d.created_at, updated: d.updated_at,
			},
			durationMs: 0,
		};
	};
}

// ─── canva_create_design ──────────────────────────────────────────────────────

export const canvaCreateDesignDefinition: LLMToolDefinition = {
	name: "canva_create_design",
	description: "Create a new Canva design from a preset or custom dimensions.",
	input_schema: {
		type: "object",
		properties: {
			title: { type: "string", description: "Design title" },
			design_type: { type: "string", description: "Design preset type e.g. 'presentation', 'instagram_post', 'doc'" },
		},
		required: ["title"],
	},
};

export function createCanvaCreateDesignExecutor(config: CanvaConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const body: Record<string, unknown> = { title: args.title };
		if (args.design_type) body.design_type = { type: "preset", name: args.design_type };
		const r = await canvaFetch(config, "/designs", "POST", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Canva ${r.status}: ${JSON.stringify(r.data)}` };
		const d = (r.data as Record<string, unknown>).design as Record<string, unknown>;
		return {
			output: {
				success: true, id: d.id, title: d.title,
				edit_url: (d.urls as Record<string, unknown>)?.edit_url,
			},
			durationMs: 0,
		};
	};
}

// ─── canva_export_design ──────────────────────────────────────────────────────

export const canvaExportDesignDefinition: LLMToolDefinition = {
	name: "canva_export_design",
	description: "Export a Canva design to PDF or PNG and get the download URL.",
	input_schema: {
		type: "object",
		properties: {
			design_id: { type: "string", description: "Canva design ID" },
			format: { type: "string", enum: ["pdf", "png", "jpg"], description: "Export format (default: pdf)" },
		},
		required: ["design_id"],
	},
};

export function createCanvaExportDesignExecutor(config: CanvaConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const format = (args.format as string | undefined) ?? "pdf";
		// Create export job
		const r = await canvaFetch(config, "/exports", "POST", {
			design_id: args.design_id,
			format: { type: format },
		});
		if (!r.ok) return { output: null, durationMs: 0, error: `Canva ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const jobId = (d.job as Record<string, unknown>)?.id;
		if (!jobId) return { output: null, durationMs: 0, error: "No export job ID returned" };

		// Poll for completion (up to 30s)
		for (let i = 0; i < 10; i++) {
			await new Promise((res) => setTimeout(res, 3000));
			const poll = await canvaFetch(config, `/exports/${jobId}`);
			if (!poll.ok) continue;
			const job = (poll.data as Record<string, unknown>).job as Record<string, unknown>;
			if (job.status === "success") {
				const urls = job.urls as string[] ?? [];
				return { output: { success: true, format, download_urls: urls }, durationMs: 0 };
			}
			if (job.status === "failed") return { output: null, durationMs: 0, error: "Export job failed" };
		}
		return { output: null, durationMs: 0, error: "Export timed out" };
	};
}
