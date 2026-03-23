import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface PlacidConfig {
	apiToken: string;
}

async function placidFetch(
	config: PlacidConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`https://api.placid.app/api/rest${path}`, {
		method,
		headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	let data: unknown;
	try {
		data = await res.json();
	} catch {
		data = null;
	}
	return { ok: res.ok, status: res.status, data };
}

export const placidListTemplatesDefinition: LLMToolDefinition = {
	name: "placid_list_templates",
	description: "List all available Placid templates.",
	input_schema: { type: "object", properties: {}, required: [] },
};

export function createPlacidListTemplatesExecutor(config: PlacidConfig): ToolExecutor {
	return async (): Promise<ToolResult> => {
		const r = await placidFetch(config, "/templates");
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Placid ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		const templates = ((d.data as Array<Record<string, unknown>>) ?? []).map((t) => ({
			uuid: t.uuid,
			title: t.title,
			width: t.width,
			height: t.height,
			layers: (t.layers as Array<Record<string, unknown>>)?.map((l) => ({
				name: l.name,
				type: l.type,
			})),
		}));
		return { output: { templates }, durationMs: 0 };
	};
}

export const placidCreateImageDefinition: LLMToolDefinition = {
	name: "placid_create_image",
	description: "Generate an image from a Placid template. Returns a URL to the generated image.",
	input_schema: {
		type: "object",
		properties: {
			template_uuid: { type: "string", description: "Template UUID from placid_list_templates" },
			layers: {
				type: "object",
				description: "Layer modifications as an object where keys are layer names",
				additionalProperties: {
					type: "object",
					properties: {
						text: { type: "string" },
						image: { type: "string", description: "Image URL" },
						color: { type: "string", description: "Hex color e.g. #FF0000" },
					},
				},
			},
			filename: { type: "string", description: "Output filename (optional)" },
		},
		required: ["template_uuid", "layers"],
	},
};

async function pollPlacidImage(config: PlacidConfig, imageId: unknown): Promise<ToolResult> {
	for (let i = 0; i < 10; i++) {
		await new Promise((res) => setTimeout(res, 2000));
		const poll = await placidFetch(config, `/images/${imageId}`);
		if (!poll.ok) continue;
		const pd = poll.data as Record<string, unknown>;
		if (pd.status === "finished") {
			return { output: { id: pd.id, status: pd.status, image_url: pd.image_url }, durationMs: 0 };
		}
	}
	return { output: null, durationMs: 0, error: "Placid image generation timed out" };
}

export function createPlacidCreateImageExecutor(config: PlacidConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const body: Record<string, unknown> = {
			template_uuid: args.template_uuid,
			layers: args.layers,
		};
		if (args.filename) body.filename = args.filename;
		const r = await placidFetch(config, "/images", "POST", body);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Placid ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		if (d.status === "queued" && d.id) {
			return pollPlacidImage(config, d.id);
		}
		return { output: { id: d.id, status: d.status, image_url: d.image_url }, durationMs: 0 };
	};
}
