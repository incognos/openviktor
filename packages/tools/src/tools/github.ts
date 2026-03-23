import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface GitHubConfig {
	token: string;
	defaultOwner?: string;
	defaultRepo?: string;
}

async function ghFetch(
	config: GitHubConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`https://api.github.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${config.token}`,
			"Content-Type": "application/json",
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
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

function repoArgs(config: GitHubConfig, args: Record<string, unknown>) {
	return {
		owner: (args.owner as string | undefined) ?? config.defaultOwner ?? "",
		repo: (args.repo as string | undefined) ?? config.defaultRepo ?? "",
	};
}

// ─── github_list_issues ───────────────────────────────────────────────────────

export const githubListIssuesDefinition: LLMToolDefinition = {
	name: "github_list_issues",
	description: "List open issues in a GitHub repository.",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner (uses default if not provided)" },
			repo: { type: "string", description: "Repo name (uses default if not provided)" },
			state: {
				type: "string",
				enum: ["open", "closed", "all"],
				description: "Issue state (default: open)",
			},
			limit: { type: "number", description: "Max results (default 20)" },
		},
		required: [],
	},
};

export function createGithubListIssuesExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const state = (args.state as string | undefined) ?? "open";
		const limit = (args.limit as number | undefined) ?? 20;
		const r = await ghFetch(
			config,
			`/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`,
		);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const issues = (r.data as Array<Record<string, unknown>>)
			.filter((i) => !i.pull_request)
			.map((i) => ({
				number: i.number,
				title: i.title,
				state: i.state,
				labels: (i.labels as Array<Record<string, unknown>>).map((l) => l.name),
				created: i.created_at,
				url: i.html_url,
			}));
		return { output: { issues, count: issues.length }, durationMs: 0 };
	};
}

// ─── github_create_issue ──────────────────────────────────────────────────────

export const githubCreateIssueDefinition: LLMToolDefinition = {
	name: "github_create_issue",
	description: "Create a new issue in a GitHub repository.",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner (uses default if not provided)" },
			repo: { type: "string", description: "Repo name (uses default if not provided)" },
			title: { type: "string", description: "Issue title" },
			body: { type: "string", description: "Issue body (markdown)" },
			labels: { type: "array", items: { type: "string" }, description: "Labels to apply" },
		},
		required: ["title"],
	},
};

export function createGithubCreateIssueExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const body: Record<string, unknown> = { title: args.title };
		if (args.body) body.body = args.body;
		if (args.labels) body.labels = args.labels;
		const r = await ghFetch(config, `/repos/${owner}/${repo}/issues`, "POST", body);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		return { output: { success: true, number: d.number, url: d.html_url }, durationMs: 0 };
	};
}

// ─── github_list_prs ──────────────────────────────────────────────────────────

export const githubListPrsDefinition: LLMToolDefinition = {
	name: "github_list_prs",
	description: "List pull requests in a GitHub repository.",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner (uses default if not provided)" },
			repo: { type: "string", description: "Repo name (uses default if not provided)" },
			state: {
				type: "string",
				enum: ["open", "closed", "all"],
				description: "PR state (default: open)",
			},
			limit: { type: "number", description: "Max results (default 20)" },
		},
		required: [],
	},
};

export function createGithubListPrsExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const state = (args.state as string | undefined) ?? "open";
		const limit = (args.limit as number | undefined) ?? 20;
		const r = await ghFetch(
			config,
			`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}`,
		);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const prs = (r.data as Array<Record<string, unknown>>).map((p) => ({
			number: p.number,
			title: p.title,
			state: p.state,
			author: (p.user as Record<string, unknown>)?.login,
			created: p.created_at,
			url: p.html_url,
		}));
		return { output: { prs, count: prs.length }, durationMs: 0 };
	};
}

// ─── github_get_pr ────────────────────────────────────────────────────────────

export const githubGetPrDefinition: LLMToolDefinition = {
	name: "github_get_pr",
	description: "Get details of a specific pull request.",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner (uses default if not provided)" },
			repo: { type: "string", description: "Repo name (uses default if not provided)" },
			pr_number: { type: "number", description: "PR number" },
		},
		required: ["pr_number"],
	},
};

export function createGithubGetPrExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const r = await ghFetch(config, `/repos/${owner}/${repo}/pulls/${args.pr_number}`);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const p = r.data as Record<string, unknown>;
		return {
			output: {
				number: p.number,
				title: p.title,
				state: p.state,
				body: p.body,
				author: (p.user as Record<string, unknown>)?.login,
				base: (p.base as Record<string, unknown>)?.ref,
				head: (p.head as Record<string, unknown>)?.ref,
				mergeable: p.mergeable,
				created: p.created_at,
				url: p.html_url,
			},
			durationMs: 0,
		};
	};
}
// ─── github_get_file ──────────────────────────────────────────────────────────

export const githubGetFileDefinition: LLMToolDefinition = {
	name: "github_get_file",
	description: "Get the contents of a file from a GitHub repository.",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner" },
			repo: { type: "string", description: "Repo name" },
			path: { type: "string", description: "File path e.g. src/index.ts" },
			ref: { type: "string", description: "Branch, tag, or SHA (default: main)" },
		},
		required: ["path"],
	},
};

export function createGithubGetFileExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const ref = (args.ref as string | undefined) ?? "main";
		const r = await ghFetch(config, `/repos/${owner}/${repo}/contents/${args.path}?ref=${ref}`);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		const content =
			d.encoding === "base64"
				? Buffer.from(d.content as string, "base64").toString("utf-8")
				: (d.content as string);
		return { output: { path: d.path, content, sha: d.sha, size: d.size }, durationMs: 0 };
	};
}

// ─── github_get_pr_diff ───────────────────────────────────────────────────────

export const githubGetPrDiffDefinition: LLMToolDefinition = {
	name: "github_get_pr_diff",
	description: "Get the diff of a pull request.",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner" },
			repo: { type: "string", description: "Repo name" },
			pr_number: { type: "number", description: "PR number" },
		},
		required: ["pr_number"],
	},
};

export function createGithubGetPrDiffExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const res = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/pulls/${args.pr_number}`,
			{
				headers: {
					Authorization: `Bearer ${config.token}`,
					Accept: "application/vnd.github.diff",
					"X-GitHub-Api-Version": "2022-11-28",
				},
			},
		);
		if (!res.ok) return { output: null, durationMs: 0, error: `GitHub ${res.status}` };
		const diff = await res.text();
		return { output: { diff: diff.slice(0, 20000) }, durationMs: 0 };
	};
}

// ─── github_create_pr_review ──────────────────────────────────────────────────

export const githubCreatePrReviewDefinition: LLMToolDefinition = {
	name: "github_create_pr_review",
	description: "Submit a review on a pull request (APPROVE, REQUEST_CHANGES, or COMMENT).",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner" },
			repo: { type: "string", description: "Repo name" },
			pr_number: { type: "number", description: "PR number" },
			body: { type: "string", description: "Review summary" },
			event: {
				type: "string",
				enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
				description: "Review action",
			},
		},
		required: ["pr_number", "body", "event"],
	},
};

export function createGithubCreatePrReviewExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const r = await ghFetch(
			config,
			`/repos/${owner}/${repo}/pulls/${args.pr_number}/reviews`,
			"POST",
			{ body: args.body, event: args.event },
		);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		return { output: { success: true, review_id: d.id, state: d.state }, durationMs: 0 };
	};
}

// ─── github_create_pr ─────────────────────────────────────────────────────────

export const githubCreatePrDefinition: LLMToolDefinition = {
	name: "github_create_pr",
	description: "Create a pull request.",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner" },
			repo: { type: "string", description: "Repo name" },
			title: { type: "string", description: "PR title" },
			body: { type: "string", description: "PR description" },
			head: { type: "string", description: "Branch to merge from" },
			base: { type: "string", description: "Branch to merge into (default: main)" },
		},
		required: ["title", "head"],
	},
};

export function createGithubCreatePrExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const body: Record<string, unknown> = {
			title: args.title,
			head: args.head,
			base: (args.base as string | undefined) ?? "main",
		};
		if (args.body) body.body = args.body;
		const r = await ghFetch(config, `/repos/${owner}/${repo}/pulls`, "POST", body);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		return { output: { success: true, number: d.number, url: d.html_url }, durationMs: 0 };
	};
}

// ─── github_push_file ─────────────────────────────────────────────────────────

export const githubPushFileDefinition: LLMToolDefinition = {
	name: "github_push_file",
	description: "Create or update a file in a GitHub repo (for committing fixes).",
	input_schema: {
		type: "object",
		properties: {
			owner: { type: "string", description: "Repo owner" },
			repo: { type: "string", description: "Repo name" },
			path: { type: "string", description: "File path in the repo" },
			content: { type: "string", description: "Full file content" },
			message: { type: "string", description: "Commit message" },
			branch: { type: "string", description: "Branch to commit to" },
			sha: { type: "string", description: "SHA of existing file (required for updates)" },
		},
		required: ["path", "content", "message", "branch"],
	},
};

export function createGithubPushFileExecutor(config: GitHubConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const { owner, repo } = repoArgs(config, args);
		const body: Record<string, unknown> = {
			message: args.message,
			content: Buffer.from(args.content as string).toString("base64"),
			branch: args.branch,
		};
		if (args.sha) body.sha = args.sha;
		const r = await ghFetch(config, `/repos/${owner}/${repo}/contents/${args.path}`, "PUT", body);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `GitHub ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		const commit = d.commit as Record<string, unknown>;
		return {
			output: {
				success: true,
				sha: (d.content as Record<string, unknown>)?.sha,
				commit_sha: commit?.sha,
			},
			durationMs: 0,
		};
	};
}
