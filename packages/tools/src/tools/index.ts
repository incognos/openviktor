import type { PrismaClient } from "@openviktor/db";
import type { LLMProvider } from "@openviktor/shared";
import { type ToolExecutor, ToolRegistry } from "../registry.js";
import {
	type SpacesService,
	createSpacesToolExecutors,
	spacesToolDefinitions,
} from "../spaces/index.js";
import {
	aiStructuredOutputDefinition,
	createAiStructuredOutputExecutor,
} from "./ai-structured-output.js";
import {
	type BannerbearConfig,
	bannerbearCreateImageDefinition,
	bannerbearListTemplatesDefinition,
	createBannerbearCreateImageExecutor,
	createBannerbearListTemplatesExecutor,
} from "./bannerbear.js";
import { bashDefinition, bashExecutor } from "./bash.js";
import {
	browserCloseSessionDefinition,
	browserCreateSessionDefinition,
	browserDownloadFilesDefinition,
	createBrowserExecutors,
} from "./browser.js";
import {
	type CanvaConfig,
	canvaCreateDesignDefinition,
	canvaExportDesignDefinition,
	canvaGetDesignDefinition,
	canvaListDesignsDefinition,
	createCanvaCreateDesignExecutor,
	createCanvaExportDesignExecutor,
	createCanvaGetDesignExecutor,
	createCanvaListDesignsExecutor,
} from "./canva.js";
import { coworkerText2ImDefinition, createText2ImExecutor } from "./coworker-text2im.js";
import {
	createCustomApiIntegrationDefinition,
	createCustomApiIntegrationExecutor,
} from "./create-custom-api-integration.js";
import {
	createDocsExecutors,
	queryLibraryDocsDefinition,
	resolveLibraryIdDefinition,
} from "./docs.js";
import {
	type FamocoConfig,
	createFamocoAssignFleetExecutor,
	createFamocoGetDeviceExecutor,
	createFamocoGetSyncStatusExecutor,
	createFamocoMoveToStockExecutor,
	createFamocoSearchDeviceExecutor,
	createFamocoTriggerSyncExecutor,
	famocoAssignFleetDefinition,
	famocoGetDeviceDefinition,
	famocoGetSyncStatusDefinition,
	famocoMoveToStockDefinition,
	famocoSearchDeviceDefinition,
	famocoTriggerSyncDefinition,
} from "./famoco.js";
import { fileEditDefinition, fileEditExecutor } from "./file-edit.js";
import { fileReadDefinition, fileReadExecutor } from "./file-read.js";
import { fileToMarkdownDefinition, fileToMarkdownExecutor } from "./file-to-markdown.js";
import { fileWriteDefinition, fileWriteExecutor } from "./file-write.js";
import { coworkerGitDefinition, coworkerGithubCliDefinition, createGitExecutors } from "./git.js";
import {
	type GitHubConfig,
	createGithubCreateIssueExecutor,
	createGithubCreatePrExecutor,
	createGithubCreatePrReviewExecutor,
	createGithubGetFileExecutor,
	createGithubGetPrDiffExecutor,
	createGithubGetPrExecutor,
	createGithubListIssuesExecutor,
	createGithubListPrsExecutor,
	createGithubPushFileExecutor,
	githubCreateIssueDefinition,
	githubCreatePrDefinition,
	githubCreatePrReviewDefinition,
	githubGetFileDefinition,
	githubGetPrDefinition,
	githubGetPrDiffDefinition,
	githubListIssuesDefinition,
	githubListPrsDefinition,
	githubPushFileDefinition,
} from "./github.js";
import { globDefinition, globExecutor } from "./glob.js";
import { grepDefinition, grepExecutor } from "./grep.js";
import {
	type JiraConfig,
	createJiraAddCommentExecutor,
	createJiraGetTicketExecutor,
	createJiraSearchTicketsExecutor,
	createJiraUpdateStatusExecutor,
	jiraAddCommentDefinition,
	jiraGetTicketDefinition,
	jiraSearchTicketsDefinition,
	jiraUpdateStatusDefinition,
} from "./jira.js";
import {
	createReadLearningsExecutor,
	createWriteLearningExecutor,
	readLearningsDefinition,
	writeLearningDefinition,
} from "./learnings.js";
import {
	type LinkedInConfig,
	createLinkedInDraftPostExecutor,
	createLinkedInGetRecentPostsExecutor,
	createLinkedInPublishPostExecutor,
	linkedInDraftPostDefinition,
	linkedInGetRecentPostsDefinition,
	linkedInPublishPostDefinition,
} from "./linkedin.js";
import {
	type NotionConfig,
	createNotionCreatePageExecutor,
	createNotionGetPageExecutor,
	createNotionQueryDatabaseExecutor,
	createNotionSearchExecutor,
	notionCreatePageDefinition,
	notionGetPageDefinition,
	notionQueryDatabaseDefinition,
	notionSearchDefinition,
} from "./notion.js";
import {
	type OpenAIImageConfig,
	createOpenAIGenerateImageExecutor,
	openaiGenerateImageDefinition,
} from "./openai_image.js";
import {
	type OpenFangConfig,
	createOpenfangHandExecutor,
	createOpenfangStatusExecutor,
	createOpenfangTaskExecutor,
	openfangHandDefinition,
	openfangStatusDefinition,
	openfangTaskDefinition,
} from "./openfang.js";
import {
	type PipedriveConfig,
	createPipedriveCreateNoteExecutor,
	createPipedriveGetDealExecutor,
	createPipedriveListActivitiesExecutor,
	createPipedriveSearchDealsExecutor,
	pipedriveCreateNoteDefinition,
	pipedriveGetDealDefinition,
	pipedriveListActivitiesDefinition,
	pipedriveSearchDealsDefinition,
} from "./pipedrive.js";
import {
	type PlacidConfig,
	createPlacidCreateImageExecutor,
	createPlacidListTemplatesExecutor,
	placidCreateImageDefinition,
	placidListTemplatesDefinition,
} from "./placid.js";
import { createQuickAiSearchExecutor, quickAiSearchDefinition } from "./quick-ai-search.js";
import {
	type SentryConfig,
	createSentryGetIssueExecutor,
	createSentryListIssuesExecutor,
	createSentryResolveIssueExecutor,
	sentryGetIssueDefinition,
	sentryListIssuesDefinition,
	sentryResolveIssueDefinition,
} from "./sentry.js";
import {
	type ShortcutConfig,
	createShortcutAddCommentExecutor,
	createShortcutCreateStoryExecutor,
	createShortcutGetStoryExecutor,
	createShortcutListEpicsExecutor,
	createShortcutListWorkflowsExecutor,
	createShortcutSearchStoriesExecutor,
	createShortcutUpdateStoryExecutor,
	shortcutAddCommentDefinition,
	shortcutCreateStoryDefinition,
	shortcutGetStoryDefinition,
	shortcutListEpicsDefinition,
	shortcutListWorkflowsDefinition,
	shortcutSearchStoriesDefinition,
	shortcutUpdateStoryDefinition,
} from "./shortcut.js";
import {
	createListSkillsExecutor,
	createReadSkillExecutor,
	createWriteSkillExecutor,
	listSkillsDefinition,
	readSkillDefinition,
	writeSkillDefinition,
} from "./skills.js";
import {
	coworkerGetSlackReactionsDefinition,
	coworkerInviteSlackUserToTeamDefinition,
	coworkerJoinSlackChannelsDefinition,
	coworkerLeaveSlackChannelsDefinition,
	coworkerListSlackChannelsDefinition,
	coworkerListSlackUsersDefinition,
	coworkerOpenSlackConversationDefinition,
	coworkerReportIssueDefinition,
	createSlackAdminExecutors,
} from "./slack-admin.js";
import {
	coworkerDeleteSlackMessageDefinition,
	coworkerDownloadFromSlackDefinition,
	coworkerSendSlackMessageDefinition,
	coworkerSlackHistoryDefinition,
	coworkerSlackReactDefinition,
	coworkerUpdateSlackMessageDefinition,
	coworkerUploadToSlackDefinition,
	createSlackToolExecutors,
} from "./slack-comms.js";
import {
	type ThreadOrchestrationDeps,
	createCreateThreadExecutor,
	createGetPathInfoExecutor,
	createListRunningPathsExecutor,
	createSendMessageToThreadExecutor,
	createThreadDefinition,
	createWaitForPathsExecutor,
	getPathInfoDefinition,
	listRunningPathsDefinition,
	sendMessageToThreadDefinition,
	waitForPathsDefinition,
} from "./thread-orchestration.js";
import { viewImageDefinition, viewImageExecutor } from "./view-image.js";
import { workspaceTreeDefinition, workspaceTreeExecutor } from "./workspace-tree.js";

export interface RegistryConfig {
	openfangUrl?: string;
	openfangApiKey?: string;
	openfangResultChannel?: string;
	jiraUrl?: string;
	jiraEmail?: string;
	jiraApiToken?: string;
	jiraProjectKey?: string;
	famocoApiKey?: string;
	famocoApiUrl?: string;
	linkedInAccessToken?: string;
	linkedInOrganizationUrn?: string;
	linkedInCompanyName?: string;
	linkedInCompanyDescription?: string;
	linkedInDefaultHashtags?: string;
	linkedInRequireApproval?: boolean;
	notionApiToken?: string;
	notionDefaultDatabaseId?: string;
	sentryAuthToken?: string;
	sentryOrganizationSlug?: string;
	sentryDefaultProjectSlug?: string;
	githubApiToken?: string;
	githubDefaultOwner?: string;
	githubDefaultRepo?: string;
	pipedriveApiToken?: string;
	pipedriveDomain?: string;
	canvaAccessToken?: string;
	shortcutApiToken?: string;
	openaiApiKey?: string;
	bannerbearApiKey?: string;
	placidApiToken?: string;
	slackToken?: string;
	githubToken?: string;
	browserbaseApiKey?: string;
	context7BaseUrl?: string;
	searchApiKey?: string;
	imagenApiKey?: string;
	llmProvider?: LLMProvider;
	defaultModel?: string;
}

export function createNativeRegistry(config: RegistryConfig = {}): ToolRegistry {
	const registry = new ToolRegistry();

	registry.register("bash", bashDefinition, bashExecutor);
	registry.register("file_read", fileReadDefinition, fileReadExecutor);
	registry.register("file_write", fileWriteDefinition, fileWriteExecutor);
	registry.register("file_edit", fileEditDefinition, fileEditExecutor);
	registry.register("glob", globDefinition, globExecutor);
	registry.register("grep", grepDefinition, grepExecutor);
	registry.register("view_image", viewImageDefinition, viewImageExecutor);

	registry.register("file_to_markdown", fileToMarkdownDefinition, fileToMarkdownExecutor);

	if (config.llmProvider) {
		registry.register(
			"ai_structured_output",
			aiStructuredOutputDefinition,
			createAiStructuredOutputExecutor(config.llmProvider, config.defaultModel),
		);
		registry.register(
			"quick_ai_search",
			quickAiSearchDefinition,
			createQuickAiSearchExecutor({
				searchApiKey: config.searchApiKey,
				llmProvider: config.llmProvider,
				model: config.defaultModel,
			}),
		);
	} else if (config.searchApiKey) {
		registry.register(
			"quick_ai_search",
			quickAiSearchDefinition,
			createQuickAiSearchExecutor({ searchApiKey: config.searchApiKey }),
		);
	}

	registry.register(
		"coworker_text2im",
		coworkerText2ImDefinition,
		createText2ImExecutor(config.imagenApiKey),
	);

	registry.register(
		"create_custom_api_integration",
		createCustomApiIntegrationDefinition,
		createCustomApiIntegrationExecutor,
	);

	registry.register("workspace_tree", workspaceTreeDefinition, workspaceTreeExecutor);
	if (config.openfangUrl) {
		const ofConfig: OpenFangConfig = {
			baseUrl: config.openfangUrl,
			apiKey: config.openfangApiKey,
			defaultResultChannel: config.openfangResultChannel,
		};
		registry.register(
			"openfang_hand",
			openfangHandDefinition,
			createOpenfangHandExecutor(ofConfig),
		);
		registry.register(
			"openfang_task",
			openfangTaskDefinition,
			createOpenfangTaskExecutor(ofConfig),
		);
		registry.register(
			"openfang_status",
			openfangStatusDefinition,
			createOpenfangStatusExecutor(ofConfig),
		);
	}

	if (config.jiraUrl && config.jiraEmail && config.jiraApiToken) {
		const jiraConfig: JiraConfig = {
			url: config.jiraUrl,
			email: config.jiraEmail,
			apiToken: config.jiraApiToken,
			projectKey: config.jiraProjectKey,
		};
		registry.register(
			"jira_get_ticket",
			jiraGetTicketDefinition,
			createJiraGetTicketExecutor(jiraConfig),
		);
		registry.register(
			"jira_add_comment",
			jiraAddCommentDefinition,
			createJiraAddCommentExecutor(jiraConfig),
		);
		registry.register(
			"jira_update_status",
			jiraUpdateStatusDefinition,
			createJiraUpdateStatusExecutor(jiraConfig),
		);
		registry.register(
			"jira_search_tickets",
			jiraSearchTicketsDefinition,
			createJiraSearchTicketsExecutor(jiraConfig),
		);
	}

	if (config.famocoApiKey && config.famocoApiUrl) {
		const famocoConfig: FamocoConfig = {
			apiKey: config.famocoApiKey,
			apiUrl: config.famocoApiUrl,
		};
		registry.register(
			"famoco_search_device",
			famocoSearchDeviceDefinition,
			createFamocoSearchDeviceExecutor(famocoConfig),
		);
		registry.register(
			"famoco_get_device",
			famocoGetDeviceDefinition,
			createFamocoGetDeviceExecutor(famocoConfig),
		);
		registry.register(
			"famoco_move_to_stock",
			famocoMoveToStockDefinition,
			createFamocoMoveToStockExecutor(famocoConfig),
		);
		registry.register(
			"famoco_assign_fleet",
			famocoAssignFleetDefinition,
			createFamocoAssignFleetExecutor(famocoConfig),
		);
		registry.register(
			"famoco_get_sync_status",
			famocoGetSyncStatusDefinition,
			createFamocoGetSyncStatusExecutor(famocoConfig),
		);
		registry.register(
			"famoco_trigger_sync",
			famocoTriggerSyncDefinition,
			createFamocoTriggerSyncExecutor(famocoConfig),
		);
	}

	if (config.linkedInAccessToken && config.linkedInOrganizationUrn) {
		const liConfig: LinkedInConfig = {
			accessToken: config.linkedInAccessToken,
			organizationUrn: config.linkedInOrganizationUrn,
			companyName: config.linkedInCompanyName ?? "the company",
			companyDescription: config.linkedInCompanyDescription,
			defaultHashtags: config.linkedInDefaultHashtags
				?.split(",")
				.map((h) => h.trim())
				.filter(Boolean),
			requireApproval: config.linkedInRequireApproval !== false,
		};
		registry.register(
			"linkedin_draft_post",
			linkedInDraftPostDefinition,
			createLinkedInDraftPostExecutor(liConfig),
		);
		registry.register(
			"linkedin_publish_post",
			linkedInPublishPostDefinition,
			createLinkedInPublishPostExecutor(liConfig),
		);
		registry.register(
			"linkedin_get_recent_posts",
			linkedInGetRecentPostsDefinition,
			createLinkedInGetRecentPostsExecutor(liConfig),
		);
	}

	if (config.notionApiToken) {
		const notionConfig: NotionConfig = {
			apiToken: config.notionApiToken,
			defaultDatabaseId: config.notionDefaultDatabaseId,
		};
		registry.register(
			"notion_search",
			notionSearchDefinition,
			createNotionSearchExecutor(notionConfig),
		);
		registry.register(
			"notion_get_page",
			notionGetPageDefinition,
			createNotionGetPageExecutor(notionConfig),
		);
		registry.register(
			"notion_create_page",
			notionCreatePageDefinition,
			createNotionCreatePageExecutor(notionConfig),
		);
		registry.register(
			"notion_query_database",
			notionQueryDatabaseDefinition,
			createNotionQueryDatabaseExecutor(notionConfig),
		);
	}

	if (config.sentryAuthToken && config.sentryOrganizationSlug) {
		const sentryConfig: SentryConfig = {
			authToken: config.sentryAuthToken,
			organizationSlug: config.sentryOrganizationSlug,
			defaultProjectSlug: config.sentryDefaultProjectSlug,
		};
		registry.register(
			"sentry_list_issues",
			sentryListIssuesDefinition,
			createSentryListIssuesExecutor(sentryConfig),
		);
		registry.register(
			"sentry_get_issue",
			sentryGetIssueDefinition,
			createSentryGetIssueExecutor(sentryConfig),
		);
		registry.register(
			"sentry_resolve_issue",
			sentryResolveIssueDefinition,
			createSentryResolveIssueExecutor(sentryConfig),
		);
	}

	if (config.githubApiToken) {
		const ghConfig: GitHubConfig = {
			token: config.githubApiToken,
			defaultOwner: config.githubDefaultOwner,
			defaultRepo: config.githubDefaultRepo,
		};
		registry.register(
			"github_list_issues",
			githubListIssuesDefinition,
			createGithubListIssuesExecutor(ghConfig),
		);
		registry.register(
			"github_create_issue",
			githubCreateIssueDefinition,
			createGithubCreateIssueExecutor(ghConfig),
		);
		registry.register(
			"github_list_prs",
			githubListPrsDefinition,
			createGithubListPrsExecutor(ghConfig),
		);
		registry.register("github_get_pr", githubGetPrDefinition, createGithubGetPrExecutor(ghConfig));
		registry.register(
			"github_get_file",
			githubGetFileDefinition,
			createGithubGetFileExecutor(ghConfig),
		);
		registry.register(
			"github_get_pr_diff",
			githubGetPrDiffDefinition,
			createGithubGetPrDiffExecutor(ghConfig),
		);
		registry.register(
			"github_create_pr_review",
			githubCreatePrReviewDefinition,
			createGithubCreatePrReviewExecutor(ghConfig),
		);
		registry.register(
			"github_create_pr",
			githubCreatePrDefinition,
			createGithubCreatePrExecutor(ghConfig),
		);
		registry.register(
			"github_push_file",
			githubPushFileDefinition,
			createGithubPushFileExecutor(ghConfig),
		);
	}

	if (config.pipedriveApiToken && config.pipedriveDomain) {
		const pdConfig: PipedriveConfig = {
			apiToken: config.pipedriveApiToken,
			companyDomain: config.pipedriveDomain,
		};
		registry.register(
			"pipedrive_search_deals",
			pipedriveSearchDealsDefinition,
			createPipedriveSearchDealsExecutor(pdConfig),
		);
		registry.register(
			"pipedrive_get_deal",
			pipedriveGetDealDefinition,
			createPipedriveGetDealExecutor(pdConfig),
		);
		// pipedrive_create_note disabled (read-only token)
		registry.register(
			"pipedrive_list_activities",
			pipedriveListActivitiesDefinition,
			createPipedriveListActivitiesExecutor(pdConfig),
		);
	}

	if (config.canvaAccessToken) {
		const canvaConfig: CanvaConfig = { accessToken: config.canvaAccessToken };
		registry.register(
			"canva_list_designs",
			canvaListDesignsDefinition,
			createCanvaListDesignsExecutor(canvaConfig),
		);
		registry.register(
			"canva_get_design",
			canvaGetDesignDefinition,
			createCanvaGetDesignExecutor(canvaConfig),
		);
		registry.register(
			"canva_create_design",
			canvaCreateDesignDefinition,
			createCanvaCreateDesignExecutor(canvaConfig),
		);
		registry.register(
			"canva_export_design",
			canvaExportDesignDefinition,
			createCanvaExportDesignExecutor(canvaConfig),
		);
	}

	if (config.shortcutApiToken) {
		const scConfig: ShortcutConfig = { apiToken: config.shortcutApiToken };
		registry.register(
			"shortcut_get_story",
			shortcutGetStoryDefinition,
			createShortcutGetStoryExecutor(scConfig),
		);
		registry.register(
			"shortcut_search_stories",
			shortcutSearchStoriesDefinition,
			createShortcutSearchStoriesExecutor(scConfig),
		);
		registry.register(
			"shortcut_create_story",
			shortcutCreateStoryDefinition,
			createShortcutCreateStoryExecutor(scConfig),
		);
		registry.register(
			"shortcut_update_story",
			shortcutUpdateStoryDefinition,
			createShortcutUpdateStoryExecutor(scConfig),
		);
		registry.register(
			"shortcut_add_comment",
			shortcutAddCommentDefinition,
			createShortcutAddCommentExecutor(scConfig),
		);
		registry.register(
			"shortcut_list_workflows",
			shortcutListWorkflowsDefinition,
			createShortcutListWorkflowsExecutor(scConfig),
		);
		registry.register(
			"shortcut_list_epics",
			shortcutListEpicsDefinition,
			createShortcutListEpicsExecutor(scConfig),
		);
	}

	if (config.openaiApiKey) {
		const oaiConfig: OpenAIImageConfig = { apiKey: config.openaiApiKey };
		registry.register(
			"openai_generate_image",
			openaiGenerateImageDefinition,
			createOpenAIGenerateImageExecutor(oaiConfig),
		);
	}

	if (config.bannerbearApiKey) {
		const bbConfig: BannerbearConfig = { apiKey: config.bannerbearApiKey };
		registry.register(
			"bannerbear_list_templates",
			bannerbearListTemplatesDefinition,
			createBannerbearListTemplatesExecutor(bbConfig),
		);
		registry.register(
			"bannerbear_create_image",
			bannerbearCreateImageDefinition,
			createBannerbearCreateImageExecutor(bbConfig),
		);
	}

	if (config.placidApiToken) {
		const placidConfig: PlacidConfig = { apiToken: config.placidApiToken };
		registry.register(
			"placid_list_templates",
			placidListTemplatesDefinition,
			createPlacidListTemplatesExecutor(placidConfig),
		);
		registry.register(
			"placid_create_image",
			placidCreateImageDefinition,
			createPlacidCreateImageExecutor(placidConfig),
		);
	}

	if (config.slackToken) {
		const slackComms = createSlackToolExecutors(config.slackToken);

		const local = { localOnly: true };
		registry.register(
			"coworker_slack_history",
			coworkerSlackHistoryDefinition,
			slackComms.coworker_slack_history,
			local,
		);
		registry.register(
			"coworker_send_slack_message",
			coworkerSendSlackMessageDefinition,
			slackComms.coworker_send_slack_message,
			local,
		);
		registry.register(
			"coworker_slack_react",
			coworkerSlackReactDefinition,
			slackComms.coworker_slack_react,
			local,
		);
		registry.register(
			"coworker_delete_slack_message",
			coworkerDeleteSlackMessageDefinition,
			slackComms.coworker_delete_slack_message,
			local,
		);
		registry.register(
			"coworker_update_slack_message",
			coworkerUpdateSlackMessageDefinition,
			slackComms.coworker_update_slack_message,
			local,
		);
		// Upload/download need filesystem access — run in Modal (not localOnly)
		// so they can see files created by bash/file_write in the sandbox.
		registry.register(
			"coworker_upload_to_slack",
			coworkerUploadToSlackDefinition,
			slackComms.coworker_upload_to_slack,
		);
		registry.register(
			"coworker_download_from_slack",
			coworkerDownloadFromSlackDefinition,
			slackComms.coworker_download_from_slack,
		);
		const slackAdmin = createSlackAdminExecutors(config.slackToken);
		registry.register(
			"coworker_list_slack_channels",
			coworkerListSlackChannelsDefinition,
			slackAdmin.coworker_list_slack_channels,
			local,
		);
		registry.register(
			"coworker_join_slack_channels",
			coworkerJoinSlackChannelsDefinition,
			slackAdmin.coworker_join_slack_channels,
			local,
		);
		registry.register(
			"coworker_open_slack_conversation",
			coworkerOpenSlackConversationDefinition,
			slackAdmin.coworker_open_slack_conversation,
			local,
		);
		registry.register(
			"coworker_leave_slack_channels",
			coworkerLeaveSlackChannelsDefinition,
			slackAdmin.coworker_leave_slack_channels,
			local,
		);
		registry.register(
			"coworker_list_slack_users",
			coworkerListSlackUsersDefinition,
			slackAdmin.coworker_list_slack_users,
			local,
		);
		registry.register(
			"coworker_invite_slack_user_to_team",
			coworkerInviteSlackUserToTeamDefinition,
			slackAdmin.coworker_invite_slack_user_to_team,
			local,
		);
		registry.register(
			"coworker_get_slack_reactions",
			coworkerGetSlackReactionsDefinition,
			slackAdmin.coworker_get_slack_reactions,
			local,
		);
		registry.register(
			"coworker_report_issue",
			coworkerReportIssueDefinition,
			slackAdmin.coworker_report_issue,
			local,
		);
	}

	const gitExecutors = createGitExecutors(config.githubToken);
	registry.register("coworker_git", coworkerGitDefinition, gitExecutors.coworker_git);
	registry.register(
		"coworker_github_cli",
		coworkerGithubCliDefinition,
		gitExecutors.coworker_github_cli,
	);

	if (config.browserbaseApiKey) {
		const browserExecutors = createBrowserExecutors(config.browserbaseApiKey);
		registry.register(
			"browser_create_session",
			browserCreateSessionDefinition,
			browserExecutors.browser_create_session,
		);
		registry.register(
			"browser_download_files",
			browserDownloadFilesDefinition,
			browserExecutors.browser_download_files,
		);
		registry.register(
			"browser_close_session",
			browserCloseSessionDefinition,
			browserExecutors.browser_close_session,
		);
	}

	const docsExecutors = createDocsExecutors(config.context7BaseUrl);
	registry.register(
		"resolve_library_id",
		resolveLibraryIdDefinition,
		docsExecutors.resolve_library_id,
	);
	registry.register(
		"query_library_docs",
		queryLibraryDocsDefinition,
		docsExecutors.query_library_docs,
	);

	return registry;
}

export function registerDbTools(registry: ToolRegistry, prisma: PrismaClient): void {
	const local = { localOnly: true };
	registry.register(
		"read_learnings",
		readLearningsDefinition,
		createReadLearningsExecutor(prisma),
		local,
	);
	registry.register(
		"write_learning",
		writeLearningDefinition,
		createWriteLearningExecutor(prisma),
		local,
	);
	registry.register("read_skill", readSkillDefinition, createReadSkillExecutor(prisma), local);
	registry.register("list_skills", listSkillsDefinition, createListSkillsExecutor(prisma), local);
	registry.register("write_skill", writeSkillDefinition, createWriteSkillExecutor(prisma), local);
}

export {
	listAvailableIntegrationsDefinition,
	listWorkspaceConnectionsDefinition,
	connectIntegrationDefinition,
	disconnectIntegrationDefinition,
	syncWorkspaceConnectionsDefinition,
	createListAvailableIntegrationsExecutor,
	createListWorkspaceConnectionsExecutor,
	createConnectIntegrationExecutor,
	createDisconnectIntegrationExecutor,
	createSyncWorkspaceConnectionsExecutor,
	createIntegrationSyncHandler,
	restoreToolsFromDb,
	convertConfigurableProps,
	actionKeyToToolName,
	extractToolSchemas,
} from "./integrations/index.js";
export type { IntegrationSyncHandler } from "./integrations/index.js";

export type SlackTokenResolver = (workspaceId: string) => string | null;

export function registerDynamicSlackTools(
	registry: ToolRegistry,
	resolveToken: SlackTokenResolver,
): void {
	function wrap(
		factory: (token: string) => Record<string, ToolExecutor>,
		toolName: string,
	): ToolExecutor {
		return async (args, ctx) => {
			const token = resolveToken(ctx.workspaceId);
			if (!token) {
				return {
					output: null,
					durationMs: 0,
					error: `No Slack token available for workspace ${ctx.workspaceId}`,
				};
			}
			return factory(token)[toolName](args, ctx);
		};
	}

	const local = { localOnly: true };

	// Slack comms tools
	registry.register(
		"coworker_slack_history",
		coworkerSlackHistoryDefinition,
		wrap(createSlackToolExecutors, "coworker_slack_history"),
		local,
	);
	registry.register(
		"coworker_send_slack_message",
		coworkerSendSlackMessageDefinition,
		wrap(createSlackToolExecutors, "coworker_send_slack_message"),
		local,
	);
	registry.register(
		"coworker_slack_react",
		coworkerSlackReactDefinition,
		wrap(createSlackToolExecutors, "coworker_slack_react"),
		local,
	);
	registry.register(
		"coworker_delete_slack_message",
		coworkerDeleteSlackMessageDefinition,
		wrap(createSlackToolExecutors, "coworker_delete_slack_message"),
		local,
	);
	registry.register(
		"coworker_update_slack_message",
		coworkerUpdateSlackMessageDefinition,
		wrap(createSlackToolExecutors, "coworker_update_slack_message"),
		local,
	);
	registry.register(
		"coworker_upload_to_slack",
		coworkerUploadToSlackDefinition,
		wrap(createSlackToolExecutors, "coworker_upload_to_slack"),
	);
	registry.register(
		"coworker_download_from_slack",
		coworkerDownloadFromSlackDefinition,
		wrap(createSlackToolExecutors, "coworker_download_from_slack"),
	);

	// Slack admin tools
	registry.register(
		"coworker_list_slack_channels",
		coworkerListSlackChannelsDefinition,
		wrap(createSlackAdminExecutors, "coworker_list_slack_channels"),
		local,
	);
	registry.register(
		"coworker_join_slack_channels",
		coworkerJoinSlackChannelsDefinition,
		wrap(createSlackAdminExecutors, "coworker_join_slack_channels"),
		local,
	);
	registry.register(
		"coworker_open_slack_conversation",
		coworkerOpenSlackConversationDefinition,
		wrap(createSlackAdminExecutors, "coworker_open_slack_conversation"),
		local,
	);
	registry.register(
		"coworker_leave_slack_channels",
		coworkerLeaveSlackChannelsDefinition,
		wrap(createSlackAdminExecutors, "coworker_leave_slack_channels"),
		local,
	);
	registry.register(
		"coworker_list_slack_users",
		coworkerListSlackUsersDefinition,
		wrap(createSlackAdminExecutors, "coworker_list_slack_users"),
		local,
	);
	registry.register(
		"coworker_invite_slack_user_to_team",
		coworkerInviteSlackUserToTeamDefinition,
		wrap(createSlackAdminExecutors, "coworker_invite_slack_user_to_team"),
		local,
	);
	registry.register(
		"coworker_get_slack_reactions",
		coworkerGetSlackReactionsDefinition,
		wrap(createSlackAdminExecutors, "coworker_get_slack_reactions"),
		local,
	);
	registry.register(
		"coworker_report_issue",
		coworkerReportIssueDefinition,
		wrap(createSlackAdminExecutors, "coworker_report_issue"),
		local,
	);
}

export type { ThreadOrchestrationDeps };

export function registerThreadOrchestrationTools(
	registry: ToolRegistry,
	deps: ThreadOrchestrationDeps,
): void {
	registry.register("create_thread", createThreadDefinition, createCreateThreadExecutor(deps));
	registry.register(
		"send_message_to_thread",
		sendMessageToThreadDefinition,
		createSendMessageToThreadExecutor(deps),
	);
	registry.register("wait_for_paths", waitForPathsDefinition, createWaitForPathsExecutor(deps));
	registry.register(
		"list_running_paths",
		listRunningPathsDefinition,
		createListRunningPathsExecutor(deps),
	);
	registry.register("get_path_info", getPathInfoDefinition, createGetPathInfoExecutor(deps));
}

export type { SpacesService };

export function registerSpacesTools(registry: ToolRegistry, service: SpacesService): void {
	const executors = createSpacesToolExecutors(service);
	const local = { localOnly: true };
	for (const definition of spacesToolDefinitions) {
		registry.register(definition.name, definition, executors[definition.name], local);
	}
}
