import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface SentryConfig {
	authToken: string;
	organizationSlug: string;
	defaultProjectSlug?: string;
}

async function sentryFetch(
	config: SentryConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`https://sentry.io/api/0${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${config.authToken}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	let data: unknown;
	try { data = await res.json(); } catch { data = null; }
	return { ok: res.ok, status: res.status, data };
}

// ─── sentry_list_issues ───────────────────────────────────────────────────────

export const sentryListIssuesDefinition: LLMToolDefinition = {
	name: "sentry_list_issues",
	description: "List unresolved issues from a Sentry project.",
	input_schema: {
		type: "object",
		properties: {
			project_slug: { type: "string", description: "Project slug (uses default if not provided)" },
			query: { type: "string", description: "Sentry query string (default: is:unresolved)" },
			limit: { type: "number", description: "Max results (default 25)" },
		},
		required: [],
	},
};

export function createSentryListIssuesExecutor(config: SentryConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const project = (args.project_slug as string | undefined) ?? config.defaultProjectSlug;
		if (!project) return { output: null, durationMs: 0, error: "No project_slug provided and no default configured" };
		const query = encodeURIComponent((args.query as string | undefined) ?? "is:unresolved");
		const limit = (args.limit as number | undefined) ?? 25;
		const r = await sentryFetch(config, `/projects/${config.organizationSlug}/${project}/issues/?query=${query}&limit=${limit}`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Sentry ${r.status}: ${JSON.stringify(r.data)}` };
		const issues = (r.data as Array<Record<string, unknown>>).map((i) => ({
			id: i.id,
			title: i.title,
			level: i.level,
			status: i.status,
			times_seen: i.count,
			users_affected: (i.userCount as number) ?? 0,
			first_seen: i.firstSeen,
			last_seen: i.lastSeen,
			url: `https://sentry.io/organizations/${config.organizationSlug}/issues/${i.id}/`,
		}));
		return { output: { issues, count: issues.length }, durationMs: 0 };
	};
}

// ─── sentry_get_issue ─────────────────────────────────────────────────────────

export const sentryGetIssueDefinition: LLMToolDefinition = {
	name: "sentry_get_issue",
	description: "Get details and latest stack trace for a Sentry issue.",
	input_schema: {
		type: "object",
		properties: {
			issue_id: { type: "string", description: "Sentry issue ID" },
		},
		required: ["issue_id"],
	},
};

export function createSentryGetIssueExecutor(config: SentryConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = args.issue_id as string;
		const [issueRes, eventRes] = await Promise.all([
			sentryFetch(config, `/issues/${id}/`),
			sentryFetch(config, `/issues/${id}/events/latest/`),
		]);
		if (!issueRes.ok) return { output: null, durationMs: 0, error: `Sentry ${issueRes.status}: ${JSON.stringify(issueRes.data)}` };
		const issue = issueRes.data as Record<string, unknown>;
		let stackTrace: string[] = [];
		if (eventRes.ok) {
			const event = eventRes.data as Record<string, unknown>;
			const entries = (event.entries as Array<Record<string, unknown>>) ?? [];
			const exEntry = entries.find((e) => e.type === "exception");
			if (exEntry) {
				const values = ((exEntry.data as Record<string, unknown>)?.values as Array<Record<string, unknown>>) ?? [];
				const frames = (values[0]?.stacktrace as Record<string, unknown>)?.frames as Array<Record<string, unknown>> ?? [];
				stackTrace = frames.slice(-5).map((f) => `${f.filename}:${f.lineNo} in ${f.function}`);
			}
		}
		return {
			output: {
				id: issue.id,
				title: issue.title,
				level: issue.level,
				status: issue.status,
				times_seen: issue.count,
				first_seen: issue.firstSeen,
				last_seen: issue.lastSeen,
				url: `https://sentry.io/organizations/${config.organizationSlug}/issues/${issue.id}/`,
				stack_trace: stackTrace,
			},
			durationMs: 0,
		};
	};
}

// ─── sentry_resolve_issue ─────────────────────────────────────────────────────

export const sentryResolveIssueDefinition: LLMToolDefinition = {
	name: "sentry_resolve_issue",
	description: "Mark a Sentry issue as resolved.",
	input_schema: {
		type: "object",
		properties: {
			issue_id: { type: "string", description: "Sentry issue ID" },
		},
		required: ["issue_id"],
	},
};

export function createSentryResolveIssueExecutor(config: SentryConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const r = await sentryFetch(config, `/issues/${args.issue_id}/`, "PUT", { status: "resolved" });
		if (!r.ok) return { output: null, durationMs: 0, error: `Sentry ${r.status}: ${JSON.stringify(r.data)}` };
		return { output: { success: true, issue_id: args.issue_id, status: "resolved" }, durationMs: 0 };
	};
}
