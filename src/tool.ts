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

const pendingBySession = new Map<string, PendingSticker>();

const SendStickerParameters = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      enum: ["happy", "love", "confused", "sigh", "awkward", "nervous", "cool"],
      description: "Sticker name to attach to the final reply.",
    },
    reason: {
      type: "string",
      description: "Short internal reason for why this sticker fits the reply.",
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
  if (ctx.sessionKey) {
    return ctx.sessionKey;
  }
  const channel = ctx.deliveryContext?.channel ?? ctx.messageChannel;
  const to = ctx.deliveryContext?.to;
  const threadId = ctx.deliveryContext?.threadId;
  if (!channel || (!to && threadId === undefined)) {
    return undefined;
  }
  return `${channel}:${to ?? "unknown"}:${threadId ?? "none"}`;
}

export function putPendingSticker(sessionKey: string, sticker: Omit<PendingSticker, "createdAt">): PendingSticker {
  const pending = { ...sticker, createdAt: Date.now() };
  pendingBySession.set(sessionKey, pending);
  return pending;
}

export function consumePendingSticker(sessionKey?: string): PendingSticker | undefined {
  if (!sessionKey) {
    return undefined;
  }
  const pending = pendingBySession.get(sessionKey);
  pendingBySession.delete(sessionKey);
  return pending;
}

export function createSendStickerTool(ctx: OpenClawPluginToolContext): AnyAgentTool | null {
  const sessionKey = getToolSessionKey(ctx);
  if (!sessionKey) {
    return null;
  }
  return {
    name: "send_sticker",
    label: "Send Sticker",
    description:
      "Queue one lightweight sticker to accompany the final reply. Use only when a small emotional reaction is helpful; do not call for serious, legal, medical, security, incident, complaint, or code-heavy replies.",
    parameters: SendStickerParameters as never,
    displaySummary: "Queue a sticker for the final reply",
    execute: async (_toolCallId, rawParams) => {
      const params = readStickerToolParams(rawParams);
      const pending = putPendingSticker(sessionKey, params);
      return toolResult(
        { queued: true, sticker: pending.name, reason: pending.reason },
        `Queued sticker: ${pending.name}`,
      );
    },
  };
}

export function resetPendingStickersForTest(): void {
  pendingBySession.clear();
}
