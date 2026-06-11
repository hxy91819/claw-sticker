import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { appendSticker, decideAutoAppend, type AutoAppendState } from "./auto-append.js";
import { resolveConfig } from "./config.js";
import { fixStickerFormat, splitStickerMediaFromContent } from "./format.js";
import { resolveHostedStickerMediaUrl, resolveStickerDeliveryUrl } from "./stickers.js";

const sessionState = new Map<string, AutoAppendState>();

type ClawStickerPluginEntry = {
  id: string;
  name: string;
  description: string;
  configSchema: unknown;
  register(api: OpenClawPluginApi): void;
};

type ReplyPayloadLike = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
};

function getSessionKey(ctx: { sessionKey?: string; channelId?: string; conversationId?: string }, event: { sessionKey?: string; to?: string }): string {
  return event.sessionKey ?? ctx.sessionKey ?? `${ctx.channelId ?? "unknown"}:${ctx.conversationId ?? event.to ?? "unknown"}`;
}

function getState(key: string): AutoAppendState {
  const state = sessionState.get(key) ?? { lastStickerAt: 0, messagesSinceSticker: Number.MAX_SAFE_INTEGER };
  sessionState.set(key, state);
  return state;
}

function channelAllowed(channels: string[], channelId?: string): boolean {
  return Boolean(channelId && channels.includes(channelId));
}

function normalizeStickerMediaUrls(mediaUrls: readonly string[] | undefined, mediaBasePath: string): string[] {
  return (mediaUrls ?? []).map((entry) => resolveStickerDeliveryUrl(entry, mediaBasePath));
}

function mergeMediaUrls(existing: readonly string[] | undefined, next: readonly string[], mediaBasePath: string): string[] | undefined {
  const merged = Array.from(
    new Set([
      ...normalizeStickerMediaUrls(existing, mediaBasePath),
      ...normalizeStickerMediaUrls(next, mediaBasePath),
    ].filter((entry) => entry.trim())),
  );
  return merged.length ? merged : undefined;
}

function normalizeStickerReplyPayload(params: {
  payload: ReplyPayloadLike;
  channelId?: string;
  sessionKey?: string;
  pluginConfig: unknown;
  logger: OpenClawPluginApi["logger"];
}): { payload?: ReplyPayloadLike; reason?: string } {
  const config = resolveConfig(params.pluginConfig);
  if (!config.enabled || !channelAllowed(config.channels, params.channelId)) {
    return {};
  }

  const originalText = String(params.payload.text ?? "");
  if (!originalText.trim()) {
    return {};
  }

  const state = getState(params.sessionKey ?? `${params.channelId ?? "unknown"}:unknown`);
  let content = originalText;
  let reason: string | undefined;

  if (config.formatGuard.enabled) {
    const fixed = fixStickerFormat(content);
    content = fixed.content;
    if (fixed.changed) {
      reason = "format_guard";
    }
  }

  let split = splitStickerMediaFromContent(content);
  if (split.mediaUrls.length > 0) {
    state.lastStickerAt = Date.now();
    state.messagesSinceSticker = 0;
    const mediaUrls = mergeMediaUrls(params.payload.mediaUrls, split.mediaUrls, config.mediaBasePath);
    params.logger.info("[claw-sticker] resolved sticker MEDIA to payload mediaUrls");
    return {
      reason: reason ?? "media_resolved",
      payload: {
        ...params.payload,
        text: split.text || undefined,
        mediaUrl: mediaUrls?.[0] ?? params.payload.mediaUrl,
        mediaUrls,
      },
    };
  }

  state.messagesSinceSticker += 1;
  const decision = decideAutoAppend({
    content,
    config: config.autoAppend,
    state,
  });

  if (decision.append) {
    content = appendSticker(content, decision.sticker);
    split = splitStickerMediaFromContent(content);
    const mediaUrls = mergeMediaUrls(params.payload.mediaUrls, split.mediaUrls, config.mediaBasePath);
    state.lastStickerAt = Date.now();
    state.messagesSinceSticker = 0;
    params.logger.info(`[claw-sticker] appended ${decision.sticker} (${decision.reason}) as payload mediaUrls`);
    return {
      reason: "auto_append",
      payload: {
        ...params.payload,
        text: split.text || undefined,
        mediaUrl: mediaUrls?.[0] ?? params.payload.mediaUrl,
        mediaUrls,
      },
    };
  }

  if (decision.reason === "dry_run") {
    params.logger.info(`[claw-sticker] dry-run would append ${decision.sticker ?? "unknown"} (${decision.signal ?? "unknown"})`);
  }

  if (content !== originalText) {
    return {
      reason: reason ?? "format_guard",
      payload: {
        ...params.payload,
        text: content || undefined,
      },
    };
  }

  return {};
}

const plugin: ClawStickerPluginEntry = definePluginEntry({
  id: "claw-sticker",
  name: "Claw Sticker",
  description: "Adds conservative WeCom stickers and fixes MEDIA sticker format before delivery.",
  register(api: OpenClawPluginApi) {
    api.registerHostedMediaResolver?.((mediaUrl) =>
      resolveHostedStickerMediaUrl(mediaUrl, resolveConfig(api.pluginConfig).mediaBasePath),
    );

    api.on(
      "reply_payload_sending",
      async (event, ctx) => {
        const result = normalizeStickerReplyPayload({
          payload: event.payload,
          channelId: event.channel ?? ctx.channelId,
          sessionKey: getSessionKey(ctx, event),
          pluginConfig: api.pluginConfig,
          logger: api.logger,
        });
        return result.payload ? { payload: result.payload } : undefined;
      },
      { priority: -50, timeoutMs: 100 },
    );
  },
});

export default plugin;

export { appendSticker, decideAutoAppend, fixStickerFormat, normalizeStickerReplyPayload };
