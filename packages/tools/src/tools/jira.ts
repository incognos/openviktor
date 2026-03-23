import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface JiraConfig {
	url: string;
	email: string;
	apiToken: string;
	projectKey?: string;
}

async function jiraFetch(
	config: JiraConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
	const res = await fetch(`${config.url}/rest/api/3${path}`, {
		method,
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	let data: unknown;
	try { data = await res.json(); } catch { data = null; }
	return { ok: res.ok, status: res.status, data };
}

function extractAdfText(doc: unknown): string {
	const parts: string[] = [];
	function traverse(node: unknown): void {
		if (!node || typeof node !== "object") return;
		const n = node as Record<string, unknown>;
		if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
		if (Array.isArray(n.content)) for (const child of n.content) traverse(child);
	}
	traverse(doc);
	return parts.join(" ");
}

// ─── jira_get_ticket ──────────────────────────────────────────────────────────

export const jiraGetTicketDefinition: LLMToolDefinition = {
	name: "jira_get_ticket",
	description: "Get detailed information about a Jira ticket including summary, description, status, priority, reporter, and assignee.",
	input_schema: {
		type: "object",
		properties: {
			ticket_key: { type: "string", description: "Jira ticket key (e.g. IRP-123)" },
		},
		required: ["ticket_key"],
	},
};

export function createJiraGetTicketExecutor(config: JiraConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const key = args.ticket_key as string;
		const r = await jiraFetch(config, `/issue/${key}?fields=summary,description,status,priority,reporter,assignee,created,updated`);
		if (!r.ok) return { output: null, durationMs: 0, error: `Jira ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		const fields = d.fields as Record<string, unknown>;
		const reporter = fields.reporter as Record<string, unknown> | null;
		const assignee = fields.assignee as Record<string, unknown> | null;
		const status = fields.status as Record<string, unknown>;
		const priority = fields.priority as Record<string, unknown> | null;
		const desc = fields.description;
		return {
			output: {
				key: d.key,
				id: d.id,
				summary: fields.summary,
				description: desc && typeof desc === "object" ? extractAdfText(desc) : (desc ?? null),
				status: (status?.name as string) ?? null,
				priority: (priority?.name as string) ?? null,
				reporter_name: (reporter?.displayName as string) ?? null,
				reporter_email: (reporter?.emailAddress as string) ?? null,
				assignee_name: (assignee?.displayName as string) ?? null,
				created: fields.created,
				updated: fields.updated,
			},
			durationMs: 0,
		};
	};
}

// ─── jira_add_comment ─────────────────────────────────────────────────────────

export const jiraAddCommentDefinition: LLMToolDefinition = {
	name: "jira_add_comment",
	description: "Add a comment to a Jira ticket. Internal comments are only visible to agents, not customers.",
	input_schema: {
		type: "object",
		properties: {
			ticket_key: { type: "string", description: "Jira ticket key (e.g. IRP-123)" },
			comment: { type: "string", description: "Comment text to add" },
			internal: { type: "boolean", description: "If true, comment is internal (agents only). Default false." },
		},
		required: ["ticket_key", "comment"],
	},
};

export function createJiraAddCommentExecutor(config: JiraConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const key = args.ticket_key as string;
		const text = args.comment as string;
		const internal = (args.internal as boolean | undefined) ?? false;

		const body: Record<string, unknown> = {
			body: {
				type: "doc",
				version: 1,
				content: [{ type: "paragraph", content: [{ type: "text", text }] }],
			},
		};
		if (internal) {
			body.visibility = { type: "role", value: "Service Desk Team" };
		}

		const r = await jiraFetch(config, `/issue/${key}/comment`, "POST", body);
		if (!r.ok) return { output: null, durationMs: 0, error: `Jira ${r.status}: ${JSON.stringify(r.data)}` };
		const d = r.data as Record<string, unknown>;
		return {
			output: { success: true, ticket_key: key, comment_id: d.id, internal, message: "Comment added successfully" },
			durationMs: 0,
		};
	};
}

// ─── jira_update_status ───────────────────────────────────────────────────────

export const jiraUpdateStatusDefinition: LLMToolDefinition = {
	name: "jira_update_status",
	description: "Update the status of a Jira ticket by transitioning it (e.g. 'In Progress', 'Resolved', 'Done').",
	input_schema: {
		type: "object",
		properties: {
			ticket_key: { type: "string", description: "Jira ticket key (e.g. IRP-123)" },
			transition_name: { type: "string", description: "Transition to execute (e.g. 'In Progress', 'Resolved', 'Done')" },
		},
		required: ["ticket_key", "transition_name"],
	},
};

export function createJiraUpdateStatusExecutor(config: JiraConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const key = args.ticket_key as string;
		const transitionName = args.transition_name as string;

		// Get available transitions
		const tr = await jiraFetch(config, `/issue/${key}/transitions`);
		if (!tr.ok) return { output: null, durationMs: 0, error: `Jira ${tr.status}: ${JSON.stringify(tr.data)}` };

		const transitions = (tr.data as Record<string, unknown>).transitions as Array<Record<string, unknown>>;
		const match = transitions.find(
			(t) => (t.name as string).toLowerCase() === transitionName.toLowerCase(),
		);

		if (!match) {
			const available = transitions.map((t) => t.name).join(", ");
			return {
				output: null,
				durationMs: 0,
				error: `Transition '${transitionName}' not found. Available: ${available}`,
			};
		}

		const r = await jiraFetch(config, `/issue/${key}/transitions`, "POST", { transition: { id: match.id } });
		if (!r.ok && r.status !== 204) return { output: null, durationMs: 0, error: `Jira ${r.status}: ${JSON.stringify(r.data)}` };

		return {
			output: { success: true, ticket_key: key, transition: transitionName, message: `Ticket transitioned to '${transitionName}' successfully` },
			durationMs: 0,
		};
	};
}

// ─── jira_search_tickets ──────────────────────────────────────────────────────

export const jiraSearchTicketsDefinition: LLMToolDefinition = {
	name: "jira_search_tickets",
	description: `Search Jira tickets using JQL (Jira Query Language).
Examples:
- 'project = IRP AND status = "Open"'
- 'project = IRP AND assignee = currentUser()'
- 'project = IRP AND created >= -7d ORDER BY created DESC'`,
	input_schema: {
		type: "object",
		properties: {
			jql: { type: "string", description: "JQL query string" },
			max_results: { type: "number", description: "Max results to return (default 50)" },
		},
		required: ["jql"],
	},
};

export function createJiraSearchTicketsExecutor(config: JiraConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const jql = args.jql as string;
		const maxResults = (args.max_results as number | undefined) ?? 50;

		const r = await jiraFetch(
			config,
			`/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,priority,reporter,created`,
		);
		if (!r.ok) return { output: null, durationMs: 0, error: `Jira ${r.status}: ${JSON.stringify(r.data)}` };

		const d = r.data as Record<string, unknown>;
		const issues = d.issues as Array<Record<string, unknown>>;

		return {
			output: {
				tickets: issues.map((i) => {
					const f = i.fields as Record<string, unknown>;
					const status = f.status as Record<string, unknown>;
					const priority = f.priority as Record<string, unknown> | null;
					const reporter = f.reporter as Record<string, unknown> | null;
					return {
						key: i.key,
						summary: f.summary,
						status: status?.name ?? null,
						priority: priority?.name ?? null,
						reporter_name: reporter?.displayName ?? null,
						created: f.created,
					};
				}),
				total_count: d.total,
				query: jql,
			},
			durationMs: 0,
		};
	};
}
