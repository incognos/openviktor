import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface OpenFangConfig {
	baseUrl: string;       // e.g. "http://localhost:4200"
	apiKey?: string;       // openfang API key if auth enabled
	slackToken?: string;   // to post results back to Slack
	defaultResultChannel?: string; // Slack channel to post Hand results
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function openfangFetch(
	config: OpenFangConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

	const res = await fetch(`${config.baseUrl}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	let data: unknown;
	try { data = await res.json(); } catch { data = null; }

	return { ok: res.ok, status: res.status, data };
}

// ─── Tool 1: openfang_hand ───────────────────────────────────────────────────

export const openfangHandDefinition: LLMToolDefinition = {
	name: "openfang_hand",
	description: `Control OpenFang autonomous Hands — pre-built agents that run on schedules and deliver
results without being prompted. Available Hands:
- researcher: Deep research with CRAAP fact-checking and APA citations
- collector: OSINT monitoring, change detection, sentiment tracking for a target (company/person/topic)
- lead: Daily lead generation with ICP scoring (0-100) and CSV/JSON export
- predictor: Superforecasting with confidence intervals and Brier scores
- clip: Video-to-shorts converter with captions
- twitter: Autonomous X account management
- browser: Web automation with approval gates

Use this when users want ongoing autonomous monitoring or research — not one-off questions.
Examples: "monitor competitor X", "track mentions of our product", "generate leads daily".`,
	input_schema: {
		type: "object",
		properties: {
			action: {
				type: "string",
				enum: ["activate", "deactivate", "pause", "resume", "status", "list"],
				description: "What to do",
			},
			hand: {
				type: "string",
				enum: ["researcher", "collector", "lead", "predictor", "clip", "twitter", "browser"],
				description: "Which Hand (omit for 'list' action)",
			},
			config: {
				type: "object",
				description: "Hand-specific config (e.g. {target: 'CompanyName'} for collector, {icp: '...'} for lead)",
				additionalProperties: true,
			},
			result_channel: {
				type: "string",
				description: "Slack channel ID to post Hand results to (optional, overrides default)",
			},
		},
		required: ["action"],
	},
};

export function createOpenfangHandExecutor(config: OpenFangConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const action = args.action as string;
		const hand = args.hand as string | undefined;
		const handConfig = args.config as Record<string, unknown> | undefined;
		const resultChannel = (args.result_channel as string | undefined) ?? config.defaultResultChannel;

		try {
			if (action === "list") {
				const r = await openfangFetch(config, "/api/v1/hands");
				return { output: r.data, durationMs: 0 };
			}

			if (!hand) {
				return { output: null, durationMs: 0, error: "hand is required for this action" };
			}

			let path: string;
			let method = "POST";
			let body: unknown;

			switch (action) {
				case "activate":
					path = `/api/v1/hands/${hand}/activate`;
					body = {
						...(handConfig ?? {}),
						...(resultChannel ? { webhook_url: `slack://${resultChannel}` } : {}),
					};
					break;
				case "deactivate":
					path = `/api/v1/hands/${hand}/deactivate`;
					break;
				case "pause":
					path = `/api/v1/hands/${hand}/pause`;
					break;
				case "resume":
					path = `/api/v1/hands/${hand}/resume`;
					break;
				case "status":
					path = `/api/v1/hands/${hand}/status`;
					method = "GET";
					break;
				default:
					return { output: null, durationMs: 0, error: `Unknown action: ${action}` };
			}

			const r = await openfangFetch(config, path, method, body);

			if (!r.ok) {
				return {
					output: null,
					durationMs: 0,
					error: `OpenFang returned ${r.status}: ${JSON.stringify(r.data)}`,
				};
			}

			return { output: r.data, durationMs: 0 };
		} catch (err) {
			return { output: null, durationMs: 0, error: `OpenFang connection failed: ${err}` };
		}
	};
}

// ─── Tool 2: openfang_task ───────────────────────────────────────────────────

export const openfangTaskDefinition: LLMToolDefinition = {
	name: "openfang_task",
	description: `Run a one-shot task on OpenFang using a specialist agent. Best for immediate,
non-recurring requests where you need deeper capability than a quick web search.

Agents available (by tier):
- researcher: Deep research, cited reports, CRAAP fact-checking
- analyst: Data analysis and structured insights
- coder: Code generation and review
- architect: System design
- writer: Long-form content

Use this for: "write a detailed report on X", "analyze this dataset", "research topic Y in depth".
Unlike openfang_hand, this runs once and returns results — it does not recur on a schedule.`,
	input_schema: {
		type: "object",
		properties: {
			agent: {
				type: "string",
				description: "Which OpenFang agent to use (e.g. 'researcher', 'analyst', 'coder')",
			},
			prompt: {
				type: "string",
				description: "The task to perform",
			},
			stream: {
				type: "boolean",
				description: "Whether to stream output (default false — wait for full result)",
			},
		},
		required: ["agent", "prompt"],
	},
};

export function createOpenfangTaskExecutor(config: OpenFangConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const agent = args.agent as string;
		const prompt = args.prompt as string;

		try {
			// Use OpenFang's OpenAI-compatible endpoint
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

			const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model: agent,
					messages: [{ role: "user", content: prompt }],
					stream: false,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				return { output: null, durationMs: 0, error: `OpenFang task failed (${res.status}): ${err}` };
			}

			const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
			const content = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

			return { output: { result: content, agent }, durationMs: 0 };
		} catch (err) {
			return { output: null, durationMs: 0, error: `OpenFang connection failed: ${err}` };
		}
	};
}

// ─── Tool 3: openfang_status ─────────────────────────────────────────────────

export const openfangStatusDefinition: LLMToolDefinition = {
	name: "openfang_status",
	description: "Check what's running on OpenFang — active Hands, recent runs, system health.",
	input_schema: {
		type: "object",
		properties: {
			check: {
				type: "string",
				enum: ["health", "hands", "agents", "recent_runs"],
				description: "What to check (default: health)",
			},
		},
		required: [],
	},
};

export function createOpenfangStatusExecutor(config: OpenFangConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const check = (args.check as string | undefined) ?? "health";

		const paths: Record<string, string> = {
			health: "/api/v1/health",
			hands: "/api/v1/hands",
			agents: "/api/v1/agents",
			recent_runs: "/api/v1/runs?limit=10",
		};

		try {
			const r = await openfangFetch(config, paths[check] ?? "/api/v1/health");
			if (!r.ok) {
				return { output: null, durationMs: 0, error: `OpenFang returned ${r.status}` };
			}
			return { output: r.data, durationMs: 0 };
		} catch (err) {
			return { output: null, durationMs: 0, error: `OpenFang unreachable: ${err}` };
		}
	};
}
