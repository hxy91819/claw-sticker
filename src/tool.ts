import type {
  AnyAgentTool,
  OpenClawPluginToolContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { isStickerName, type StickerName } from "./stickers.js";

export type PendingSticker = {
  name: StickerName;
  reason?: string;
  createdAt: number;
};

const MAX_PENDING_STICKERS_PER_SESSION = 8;
const pendingBySession = new Map<string, PendingSticker[]>();

const SendStickerParameters = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      enum: ["happy", "love", "confused", "sigh", "awkward", "nervous", "cool"],
      description:
        "Sticker name: happy for light success/thanks, cool for casual confidence, love for warm appreciation, confused for mild uncertainty, sigh/awkward/nervous only for gentle self-deprecating or tense-but-safe moments.",
    },
    reason: {
      type: "string",
      description:
        "Short internal reason for why this sticker fits. Do not mention this reason in the user-facing reply.",
    },
  },
  required: ["name"],
} as const;

function toolResult(details: unknown, text: string) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStickerToolParams(rawParams: unknown): { name: StickerName; reason?: string } {
  const params = rawParams && typeof rawParams === "object" ? (rawParams as Record<string, unknown>) : {};
  const name = readOptionalString(params.name)?.toLowerCase();
  if (!name || !isStickerName(name)) {
    throw new Error("name must be one of: happy, love, confused, sigh, awkward, nervous, cool");
  }
  return {
    name,
    reason: readOptionalString(params.reason),
  };
}

export function getToolSessionKey(ctx: Pick<OpenClawPluginToolContext, "sessionKey" | "messageChannel" | "deliveryContext">): string | undefined {
  return getToolSessionKeys(ctx)[0];
}

export function getToolSessionKeys(ctx: Pick<OpenClawPluginToolContext, "sessionKey" | "messageChannel" | "deliveryContext">): string[] {
  const keys: string[] = [];
  if (ctx.sessionKey) {
    keys.push(ctx.sessionKey);
  }
  const channel = ctx.deliveryContext?.channel ?? ctx.messageChannel;
  const to = ctx.deliveryContext?.to;
  const threadId = ctx.deliveryContext?.threadId;
  if (channel && (to || threadId !== undefined)) {
    keys.push(`${channel}:${to ?? "unknown"}:${threadId ?? "none"}`);
  }
  if (channel && to) {
    keys.push(`${channel}:${to}`);
  }
  return Array.from(new Set(keys));
}

export function putPendingSticker(sessionKey: string, sticker: Omit<PendingSticker, "createdAt">): PendingSticker {
  const pending = { ...sticker, createdAt: Date.now() };
  const existing = pendingBySession.get(sessionKey) ?? [];
  pendingBySession.set(sessionKey, [...existing, pending].slice(-MAX_PENDING_STICKERS_PER_SESSION));
  return pending;
}

export function putPendingStickerForKeys(sessionKeys: readonly string[], sticker: Omit<PendingSticker, "createdAt">): PendingSticker {
  const uniqueKeys = Array.from(new Set(sessionKeys.filter((key) => key.trim())));
  if (uniqueKeys.length === 0) {
    throw new Error("send_sticker requires a session key");
  }
  let pending: PendingSticker | undefined;
  for (const key of uniqueKeys) {
    pending = putPendingSticker(key, sticker);
  }
  return pending as PendingSticker;
}

export function consumePendingStickers(sessionKey?: string | readonly string[]): PendingSticker[] {
  const keys = Array.isArray(sessionKey) ? sessionKey : sessionKey ? [sessionKey] : [];
  if (keys.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const pending: PendingSticker[] = [];
  for (const key of Array.from(new Set(keys))) {
    const entries = pendingBySession.get(key) ?? [];
    pendingBySession.delete(key);
    for (const entry of entries) {
      const dedupeKey = `${entry.createdAt}:${entry.name}:${entry.reason ?? ""}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      pending.push(entry);
    }
  }
  return pending.slice(-MAX_PENDING_STICKERS_PER_SESSION);
}

export function consumePendingSticker(sessionKey?: string): PendingSticker | undefined {
  return consumePendingStickers(sessionKey)[0];
}

export function createSendStickerTool(ctx: OpenClawPluginToolContext): AnyAgentTool | null {
  const sessionKeys = getToolSessionKeys(ctx);
  if (sessionKeys.length === 0) {
    return null;
  }
  return {
    name: "send_sticker",
    label: "Send Sticker",
    description:
      "Queue a lightweight sticker image to accompany the final reply. Use sparingly, only when a small emotional reaction naturally improves a casual WeCom reply, such as friendly thanks, light celebration, playful acknowledgement, or mild confusion. Do not use for serious, legal, medical, security, incident, complaint, conflict, code-heavy, review, operational, or high-stakes replies. Do not call this tool just because it exists. Do not announce that you sent a sticker or list sticker names in the visible reply unless the user explicitly asks. Prefer at most one sticker for normal replies; use multiple only when the user explicitly asks to test or send several stickers.",
    parameters: SendStickerParameters as never,
    displaySummary: "Queue a sticker for the final reply",
    execute: async (_toolCallId, rawParams) => {
      const params = readStickerToolParams(rawParams);
      const pending = putPendingStickerForKeys(sessionKeys, params);
      const mediaLine = `MEDIA: stickers/${pending.name}.png`;
      return toolResult(
        { queued: true, sticker: pending.name, reason: pending.reason, mediaLine, sessionKeys },
        `Queued sticker: ${pending.name}\n${mediaLine}`,
      );
    },
  };
}

export function resetPendingStickersForTest(): void {
  pendingBySession.clear();
}
