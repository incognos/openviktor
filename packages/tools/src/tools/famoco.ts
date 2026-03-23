import type { LLMToolDefinition, ToolResult } from "@openviktor/shared";
import type { ToolExecutor } from "../registry.js";

export interface FamocoConfig {
	apiKey: string;
	apiUrl: string; // e.g. https://my.famoco.com/api/organizations/2059
}

async function famocoFetch(
	config: FamocoConfig,
	path: string,
	method = "GET",
	body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(`${config.apiUrl}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
			Accept: "application/json",
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

function mapDevice(d: Record<string, unknown>): Record<string, unknown> {
	return {
		device_id: d.id ?? d.device_id,
		famoco_id: d.famoco_id,
		serial_number: d.serial_number,
		fleet_name: (d.fleet as Record<string, unknown> | null)?.name ?? d.fleet_name ?? null,
		fleet_id: (d.fleet as Record<string, unknown> | null)?.id ?? d.fleet_id ?? null,
		profile_name: (d.profile as Record<string, unknown> | null)?.name ?? d.profile_name ?? null,
		effective_profile_name: d.effective_profile_name ?? null,
		is_online: d.is_online ?? d.online ?? null,
		sync_status: d.sync_status ?? null,
		last_sync_time: d.last_sync_time ?? null,
		model: d.model ?? null,
		os_version: d.os_version ?? null,
		api_level: d.api_level ?? null,
		is_archived: d.is_archived ?? null,
		heartbeat: d.heartbeat ?? null,
		comment: d.comment ?? null,
		current_custom_id: d.current_custom_id ?? null,
		target_custom_id: d.target_custom_id ?? null,
		warranty_status: d.warranty_status ?? null,
		battery_level: d.battery_level ?? null,
		battery_plugged: d.battery_plugged ?? null,
	};
}

// ─── famoco_search_device ─────────────────────────────────────────────────────

export const famocoSearchDeviceDefinition: LLMToolDefinition = {
	name: "famoco_search_device",
	description:
		"Search for Famoco MDM devices by partial ID (last 3 characters of the Famoco ID on the device sticker).",
	input_schema: {
		type: "object",
		properties: {
			partial_id: {
				type: "string",
				description: "Last 3 characters of the Famoco ID (e.g. '4A2')",
			},
		},
		required: ["partial_id"],
	},
};

export function createFamocoSearchDeviceExecutor(config: FamocoConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const partial = args.partial_id as string;
		const r = await famocoFetch(config, `/devices/?search=${encodeURIComponent(partial)}&limit=10`);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Famoco ${r.status}: ${JSON.stringify(r.data)}`,
			};

		const d = r.data as Record<string, unknown>;
		const results = (d.results ?? d) as Array<Record<string, unknown>>;
		const devices = results.map(mapDevice);

		return {
			output: {
				devices,
				total_count: devices.length,
				is_unique: devices.length === 1,
				requires_clarification: devices.length > 1,
				search_query: partial,
			},
			durationMs: 0,
		};
	};
}

// ─── famoco_get_device ────────────────────────────────────────────────────────

export const famocoGetDeviceDefinition: LLMToolDefinition = {
	name: "famoco_get_device",
	description: "Get full details about a specific Famoco device by its internal device ID.",
	input_schema: {
		type: "object",
		properties: {
			device_id: { type: "string", description: "Internal Famoco device ID (not the sticker ID)" },
		},
		required: ["device_id"],
	},
};

export function createFamocoGetDeviceExecutor(config: FamocoConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = args.device_id as string;
		const r = await famocoFetch(config, `/devices/${id}/`);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Famoco ${r.status}: ${JSON.stringify(r.data)}`,
			};
		return { output: mapDevice(r.data as Record<string, unknown>), durationMs: 0 };
	};
}

// ─── famoco_move_to_stock ─────────────────────────────────────────────────────

export const famocoMoveToStockDefinition: LLMToolDefinition = {
	name: "famoco_move_to_stock",
	description: `Move a Famoco device to the stock fleet. This triggers a device wipe and prepares it for reassignment.
⚠️ DESTRUCTIVE — always request human approval before using this tool.`,
	input_schema: {
		type: "object",
		properties: {
			device_id: { type: "string", description: "Internal Famoco device ID" },
		},
		required: ["device_id"],
	},
};

export function createFamocoMoveToStockExecutor(config: FamocoConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = args.device_id as string;
		// Get fleet list to find the stock fleet
		const fleets = await famocoFetch(config, "/fleets/?limit=100");
		if (!fleets.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Famoco ${fleets.status}: failed to list fleets`,
			};

		const fleetData = fleets.data as Record<string, unknown>;
		const fleetList = (fleetData.results ?? fleetData) as Array<Record<string, unknown>>;
		const stockFleet = fleetList.find((f) => (f.name as string)?.toLowerCase().includes("stock"));

		if (!stockFleet) {
			return {
				output: null,
				durationMs: 0,
				error:
					"Could not find a fleet named 'stock'. Please specify the fleet ID manually using famoco_assign_fleet.",
			};
		}

		const r = await famocoFetch(config, `/devices/${id}/`, "PATCH", { fleet: stockFleet.id });
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Famoco ${r.status}: ${JSON.stringify(r.data)}`,
			};

		return {
			output: {
				success: true,
				device_id: id,
				fleet_id: stockFleet.id,
				message: "Device moved to stock fleet successfully",
			},
			durationMs: 0,
		};
	};
}

// ─── famoco_assign_fleet ──────────────────────────────────────────────────────

export const famocoAssignFleetDefinition: LLMToolDefinition = {
	name: "famoco_assign_fleet",
	description: "Assign a Famoco device to a specific fleet by fleet ID.",
	input_schema: {
		type: "object",
		properties: {
			device_id: { type: "string", description: "Internal Famoco device ID" },
			fleet_id: { type: "string", description: "Target fleet ID" },
		},
		required: ["device_id", "fleet_id"],
	},
};

export function createFamocoAssignFleetExecutor(config: FamocoConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = args.device_id as string;
		const fleetId = args.fleet_id as string;
		const r = await famocoFetch(config, `/devices/${id}/`, "PATCH", { fleet: fleetId });
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Famoco ${r.status}: ${JSON.stringify(r.data)}`,
			};
		return {
			output: {
				success: true,
				device_id: id,
				fleet_id: fleetId,
				message: `Device assigned to fleet ${fleetId}`,
			},
			durationMs: 0,
		};
	};
}

// ─── famoco_get_sync_status ───────────────────────────────────────────────────

export const famocoGetSyncStatusDefinition: LLMToolDefinition = {
	name: "famoco_get_sync_status",
	description: "Check the synchronization status of a Famoco device.",
	input_schema: {
		type: "object",
		properties: {
			device_id: { type: "string", description: "Internal Famoco device ID" },
		},
		required: ["device_id"],
	},
};

export function createFamocoGetSyncStatusExecutor(config: FamocoConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = args.device_id as string;
		const r = await famocoFetch(config, `/devices/${id}/`);
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Famoco ${r.status}: ${JSON.stringify(r.data)}`,
			};
		const d = r.data as Record<string, unknown>;
		return {
			output: {
				device_id: id,
				sync_status: d.sync_status ?? null,
				last_sync_time: d.last_sync_time ?? null,
				is_online: d.is_online ?? d.online ?? null,
			},
			durationMs: 0,
		};
	};
}

// ─── famoco_trigger_sync ──────────────────────────────────────────────────────

export const famocoTriggerSyncDefinition: LLMToolDefinition = {
	name: "famoco_trigger_sync",
	description: "Send a remote sync signal to a Famoco device. The device must be online.",
	input_schema: {
		type: "object",
		properties: {
			device_id: { type: "string", description: "Internal Famoco device ID" },
		},
		required: ["device_id"],
	},
};

export function createFamocoTriggerSyncExecutor(config: FamocoConfig): ToolExecutor {
	return async (args): Promise<ToolResult> => {
		const id = args.device_id as string;
		const r = await famocoFetch(config, `/devices/${id}/sync/`, "POST");
		if (!r.ok)
			return {
				output: null,
				durationMs: 0,
				error: `Famoco ${r.status}: ${JSON.stringify(r.data)}`,
			};
		return {
			output: { success: true, device_id: id, message: "Sync signal sent successfully" },
			durationMs: 0,
		};
	};
}
