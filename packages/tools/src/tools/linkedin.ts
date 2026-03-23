import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface LinkedInConfig {
	accessToken: string;
	organizationUrn: string; // urn:li:organization:XXXXXXXX
	companyName: string;
	companyDescription?: string;
	defaultHashtags?: string[];
	requireApproval?: boolean;
}

async function linkedInFetch(
	config: LinkedInConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`https://api.linkedin.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${config.accessToken}`,
			"Content-Type": "application/json",
			"X-Restli-Protocol-Version": "2.0.0",
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

// ─── linkedin_draft_post ──────────────────────────────────────────────────────

export const linkedInDraftPostDefinition: LLMToolDefinition = {
	name: "linkedin_draft_post",
	description: `Draft a LinkedIn post for the company page. Generates two variations with a recommendation.
Use when someone asks to create, write, or draft a LinkedIn post.
Provide the topic/theme; the tool handles formatting, hooks, hashtags, and brand voice.
Always presents drafts for human review before posting — use linkedin_publish_post to actually publish.`,
	input_schema: {
		type: "object",
		properties: {
			topic: {
				type: "string",
				description:
					"Topic, theme, or key message for the post (e.g. 'new partnership with X', 'thought leadership on MDM security', 'team milestone')",
			},
			post_format: {
				type: "string",
				enum: [
					"insight",
					"behind_scenes",
					"case_study",
					"hot_take",
					"how_to",
					"announcement",
					"question",
					"reactive",
				],
				description:
					"Post format. 'insight'=non-obvious domain insight, 'behind_scenes'=how we work, 'case_study'=customer outcome, 'hot_take'=industry position, 'how_to'=actionable tips, 'announcement'=milestone/launch, 'question'=audience engagement, 'reactive'=response to news. If unsure, omit and the tool will choose.",
			},
			brand_voice: {
				type: "string",
				enum: [
					"professional_friendly",
					"authoritative",
					"bold_direct",
					"thought_leader",
					"startup_energy",
				],
				description: "Tone for the post. Default: professional_friendly",
			},
			key_points: {
				type: "string",
				description: "Optional: specific facts, numbers, or points to include",
			},
			extra_hashtags: {
				type: "array",
				items: { type: "string" },
				description: "Optional additional hashtags (without #)",
			},
		},
		required: ["topic"],
	},
};

export function createLinkedInDraftPostExecutor(config: LinkedInConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const topic = args.topic as string;
		const format = (args.post_format as string | undefined) ?? "insight";
		const voice = (args.brand_voice as string | undefined) ?? "professional_friendly";
		const keyPoints = args.key_points as string | undefined;
		const extraHashtags = (args.extra_hashtags as string[] | undefined) ?? [];
		const allHashtags = [...(config.defaultHashtags ?? []), ...extraHashtags];

		const voiceGuide: Record<string, string> = {
			professional_friendly:
				"Warm, approachable, knowledgeable. Use 'we' and 'our team'. Avoid jargon. Celebrate people.",
			authoritative:
				"Data-driven, confident. Cite sources where possible. Short declarative sentences. Position as the trusted expert.",
			bold_direct:
				"Short punchy sentences. Contrarian if warranted. No hedging. Take a clear position.",
			thought_leader:
				"Share original insight, challenge conventional wisdom, invite debate. End with an open question.",
			startup_energy:
				"Behind-the-scenes, authentic, fast-moving. Celebrate milestones and lessons from failures.",
		};

		const formatGuide: Record<string, string> = {
			insight:
				"Share a non-obvious insight. Open with the surprising truth, explain it, give a takeaway.",
			behind_scenes:
				"Show how your team works. Make it human and specific — name things, give context.",
			case_study:
				"Tease a customer outcome with a specific result. Open with the problem, hint at the solution, share the number.",
			hot_take:
				"Take a clear position on an industry debate. State the conventional wisdom, then flip it.",
			how_to:
				"Give 3-5 actionable tips. Use a numbered list. Each point should be immediately usable.",
			announcement:
				"Lead with the news. Then explain why it matters. Keep it punchy — details go in comments or a linked post.",
			question:
				"Ask something your audience will have an opinion on. Make it easy to answer in one line.",
			reactive: "Reference a recent industry event or trend. Share your perspective. Be timely.",
		};

		const hashtagStr = allHashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");

		// Build the two post variations using the LLM context
		// We return structured guidance for the AI to fill in, plus metadata
		return {
			output: {
				status: "draft_ready",
				topic,
				format,
				voice,
				instructions: {
					company: config.companyName,
					company_description: config.companyDescription ?? "",
					voice_guide: voiceGuide[voice] ?? voiceGuide.professional_friendly,
					format_guide: formatGuide[format] ?? formatGuide.insight,
					key_points: keyPoints ?? "none provided",
					hashtags: hashtagStr || "(no default hashtags configured)",
					linkedin_rules: [
						"Hook in first line — make it impossible to scroll past",
						"Max 3-4 sentences per paragraph, generous line breaks",
						"Optimal length: 800-1300 characters for engagement posts",
						"End with a question or CTA",
						"3-5 hashtags at the end",
						"First-person 'we/our' for company voice",
						"Specific > vague: use real numbers and concrete examples",
						"Never start with 'I am pleased to announce' or 'Excited to share'",
					],
					task: "Generate TWO variations (Version A and Version B) of this LinkedIn post. Make them meaningfully different — different hook, different angle. Then state which you recommend and why. Format both clearly with character count.",
				},
				next_step:
					config.requireApproval !== false
						? "Present both versions to the user for approval. Once approved, use linkedin_publish_post with the chosen text."
						: "Present both versions. If user approves, use linkedin_publish_post.",
			},
			durationMs: 0,
		};
	};
}

// ─── linkedin_publish_post ────────────────────────────────────────────────────

export const linkedInPublishPostDefinition: LLMToolDefinition = {
	name: "linkedin_publish_post",
	description: `Publish an approved post to the company LinkedIn page.
Only use this AFTER the user has explicitly approved the post text.
Never call this without human approval first.`,
	input_schema: {
		type: "object",
		properties: {
			text: {
				type: "string",
				description: "The exact post text to publish (including hashtags)",
			},
		},
		required: ["text"],
	},
};

export function createLinkedInPublishPostExecutor(config: LinkedInConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const text = args.text as string;

		if (text.length > 3000) {
			return {
				output: null,
				durationMs: 0,
				error: `Post too long: ${text.length} characters (max 3000). Please shorten it.`,
			};
		}

		const payload = {
			author: config.organizationUrn,
			lifecycleState: "PUBLISHED",
			specificContent: {
				"com.linkedin.ugc.ShareContent": {
					shareCommentary: { text },
					shareMediaCategory: "NONE",
				},
			},
			visibility: {
				"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
			},
		};

		const r = await linkedInFetch(config, "/v2/ugcPosts", "POST", payload);

		if (!r.ok) {
			const d = r.data as Record<string, unknown> | null;
			const msg = d?.message ?? d?.status ?? JSON.stringify(d);
			return {
				output: null,
				durationMs: 0,
				error: `LinkedIn API error ${r.status}: ${msg}`,
			};
		}

		const d = r.data as Record<string, unknown>;
		const postId = d.id as string;
		const postUrl = postId ? `https://www.linkedin.com/feed/update/${postId}/` : null;

		return {
			output: {
				success: true,
				post_id: postId,
				url: postUrl,
				character_count: text.length,
				message: postUrl ? `✅ Published! View at: ${postUrl}` : "✅ Post published successfully.",
			},
			durationMs: 0,
		};
	};
}

// ─── linkedin_get_recent_posts ────────────────────────────────────────────────

export const linkedInGetRecentPostsDefinition: LLMToolDefinition = {
	name: "linkedin_get_recent_posts",
	description:
		"Get the most recent posts from your company LinkedIn page. Useful for reviewing what was recently published before drafting new content.",
	input_schema: {
		type: "object",
		properties: {
			count: {
				type: "number",
				description: "Number of recent posts to fetch (default 5, max 20)",
			},
		},
		required: [],
	},
};

export function createLinkedInGetRecentPostsExecutor(config: LinkedInConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const count = Math.min((args.count as number | undefined) ?? 5, 20);
		const encodedUrn = encodeURIComponent(config.organizationUrn);
		const r = await linkedInFetch(
			config,
			`/v2/ugcPosts?q=authors&authors=List(${encodedUrn})&count=${count}&sortBy=LAST_MODIFIED`,
		);

		if (!r.ok) {
			return {
				output: null,
				durationMs: 0,
				error: `LinkedIn API error ${r.status}: ${JSON.stringify((r.data as Record<string, unknown>)?.message ?? r.data)}`,
			};
		}

		const d = r.data as Record<string, unknown>;
		const elements = (d.elements ?? []) as Array<Record<string, unknown>>;

		return {
			output: {
				posts: elements.map((p) => {
					const content = p.specificContent as Record<string, unknown> | undefined;
					const shareContent = content?.["com.linkedin.ugc.ShareContent"] as
						| Record<string, unknown>
						| undefined;
					const text =
						(shareContent?.shareCommentary as Record<string, unknown> | undefined)?.text ?? "";
					return {
						id: p.id,
						text:
							typeof text === "string" ? text.slice(0, 300) + (text.length > 300 ? "..." : "") : "",
						created: p.created,
						last_modified: p.lastModified,
						url: `https://www.linkedin.com/feed/update/${p.id}/`,
					};
				}),
				total: elements.length,
			},
			durationMs: 0,
		};
	};
}
