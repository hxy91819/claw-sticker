import { DEFAULT_AUTO_APPEND_CONFIG, type AutoAppendConfig } from "./auto-append.js";

export type ClawStickerConfig = {
  enabled: boolean;
  channels: string[];
  mediaBasePath: string;
  tool: { enabled: boolean };
  formatGuard: { enabled: boolean };
  autoAppend: Partial<AutoAppendConfig>;
};

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function resolveConfig(raw: unknown): ClawStickerConfig {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tool = obj.tool && typeof obj.tool === "object" ? (obj.tool as Record<string, unknown>) : {};
  const formatGuard = obj.formatGuard && typeof obj.formatGuard === "object" ? (obj.formatGuard as Record<string, unknown>) : {};
  const autoAppend = obj.autoAppend && typeof obj.autoAppend === "object" ? (obj.autoAppend as Record<string, unknown>) : {};
  return {
    enabled: booleanValue(obj.enabled, true),
    channels: Array.isArray(obj.channels) && obj.channels.every((entry) => typeof entry === "string") ? obj.channels : ["wecom"],
    mediaBasePath: stringValue(obj.mediaBasePath, "{workspaceDir}/stickers"),
    tool: {
      enabled: booleanValue(tool.enabled, true),
    },
    formatGuard: {
      enabled: booleanValue(formatGuard.enabled, true),
    },
    autoAppend: {
      enabled: booleanValue(autoAppend.enabled, false),
      dryRun: booleanValue(autoAppend.dryRun, DEFAULT_AUTO_APPEND_CONFIG.dryRun),
      maxTextLength: numberValue(autoAppend.maxTextLength, DEFAULT_AUTO_APPEND_CONFIG.maxTextLength),
      cooldownMs: numberValue(autoAppend.cooldownMs, DEFAULT_AUTO_APPEND_CONFIG.cooldownMs),
      minAssistantMessagesBetweenStickers: numberValue(
        autoAppend.minAssistantMessagesBetweenStickers,
        DEFAULT_AUTO_APPEND_CONFIG.minAssistantMessagesBetweenStickers,
      ),
    },
  };
}
