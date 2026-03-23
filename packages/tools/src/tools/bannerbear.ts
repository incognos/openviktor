import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface BannerbearConfig {
	apiKey: string;
}

async function bbFetch(
	config: BannerbearConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`https://api.bannerbear.com/v2${path}`, {
		method,
		headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
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

export const bannerbearListTemplatesDefinition: LLMToolDefinition = {
	name: "bannerbear_list_templates",
	description: "List all available Bannerbear templates.",
	input_schema: { type: "object", properties: {}, required: [] },
};

export function createBannerbearListTemplatesExecutor(config: BannerbearConfig): ToolExecutor {
	return async (): Promise<ToolResult> => {
		const r = await bbFetch(config, "/templates");
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Bannerbear ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const templates = (r.data as Array<Record<string, unknown>>).map((t) => ({
			uid: t.uid,
			name: t.name,
			width: t.width,
			height: t.height,
			available_modifications: (t.available_modifications as Array<Record<string, unknown>>)?.map(
				(m) => ({ name: m.name, type: m.type }),
			),
		}));
		return { output: { templates }, durationMs: 0 };
	};
}

export const bannerbearCreateImageDefinition: LLMToolDefinition = {
	name: "bannerbear_create_image",
	description:
		"Generate an image from a Bannerbear template by filling in text/image modifications. Returns the image URL when ready.",
	input_schema: {
		type: "object",
		properties: {
			template_uid: { type: "string", description: "Template UID from bannerbear_list_templates" },
			modifications: {
				type: "array",
				description: "List of modifications to apply to the template",
				items: {
					type: "object",
					properties: {
						name: { type: "string", description: "Modification layer name" },
						text: { type: "string", description: "Text content (for text layers)" },
						image_url: { type: "string", description: "Image URL (for image layers)" },
						color: { type: "string", description: "Color hex e.g. #FF0000 (for color layers)" },
					},
					required: ["name"],
				},
			},
		},
		required: ["template_uid", "modifications"],
	},
};

export function createBannerbearCreateImageExecutor(config: BannerbearConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const r = await bbFetch(config, "/images", "POST", {
			template: args.template_uid,
			modifications: args.modifications,
			synchronous: true,
		});
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Bannerbear ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		return {
			output: {
				uid: d.uid,
				status: d.status,
				image_url: d.image_url,
				image_url_png: d.image_url_png,
				image_url_jpg: d.image_url_jpg,
			},
			durationMs: 0,
		};
	};
}
