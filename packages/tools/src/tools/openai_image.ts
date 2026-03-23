import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface OpenAIImageConfig {
	apiKey: string;
}

export const openaiGenerateImageDefinition: LLMToolDefinition = {
	name: "openai_generate_image",
	description:
		"Generate an image using OpenAI gpt-image-1. Good for social media graphics, illustrations, and creative visuals with accurate text rendering.",
	input_schema: {
		type: "object",
		properties: {
			prompt: { type: "string", description: "Detailed description of the image to generate" },
			size: {
				type: "string",
				enum: ["1024x1024", "1536x1024", "1024x1536"],
				description:
					"Image dimensions (default: 1024x1024). Use 1536x1024 for landscape, 1024x1536 for portrait/LinkedIn.",
			},
			quality: {
				type: "string",
				enum: ["low", "medium", "high"],
				description: "Image quality (default: medium)",
			},
			output_format: {
				type: "string",
				enum: ["png", "jpeg", "webp"],
				description: "Output format (default: png)",
			},
		},
		required: ["prompt"],
	},
};

export function createOpenAIGenerateImageExecutor(config: OpenAIImageConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const res = await fetch("https://api.openai.com/v1/images/generations", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-image-1",
				prompt: args.prompt,
				n: 1,
				size: (args.size as string | undefined) ?? "1024x1024",
				quality: (args.quality as string | undefined) ?? "medium",
				output_format: (args.output_format as string | undefined) ?? "png",
			}),
		});
		let data: unknown;
		try {
			data = await res.json();
		} catch {
			data = null;
		}
		if (!res.ok)
			return {
				output: null,
				durationMs: 0,
				error: `OpenAI ${res.status}: ${JSON.stringify(data)}`,
			};
		const d = data as Record<string, unknown>;
		const images = d.data as Array<Record<string, unknown>>;
		const image = images?.[0];
		return {
			output: {
				url: image?.url ?? null,
				b64_json: image?.b64_json ?? null,
				revised_prompt: image?.revised_prompt ?? null,
			},
			durationMs: 0,
		};
	};
}
