import { definePluginEntry, type OpenClawPluginApi, type OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { appendSticker, decideAutoAppend, type AutoAppendState } from "./auto-append.js";
import { ensureStickerAssets, resolveRuntimeMediaBasePath } from "./assets.js";
import { resolveConfig } from "./config.js";
import { fixStickerFormat, splitStickerMediaFromContent } from "./format.js";
import { renderSticker, resolveHostedStickerMediaUrl, resolveStickerDeliveryUrl } from "./stickers.js";
import { consumePendingStickers, createSendStickerTool, type PendingSticker } from "./tool.js";

const sessionState = new Map<string, AutoAppendState>();

type ClawStickerPluginEntry = {
  id: string;
  name: string;
  description: string;
  configSchema: unknown;
  register(api: OpenClawPluginApi): void;
};

type ToolCompatiblePluginApi = Omit<OpenClawPluginApi, "registerTool"> & {
  registerTool?: OpenClawPluginApi["registerTool"];
};

type ReplyPayloadLike = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
};

function getSessionKey(ctx: { sessionKey?: string; channelId?: string; conversationId?: string }, event: { sessionKey?: string; to?: string }): string {
  return event.sessionKey ?? ctx.sessionKey ?? `${ctx.channelId ?? "unknown"}:${ctx.conversationId ?? event.to ?? "unknown"}`;
}

function getSessionKeys(ctx: { sessionKey?: string; channelId?: string; conversationId?: string }, event: { sessionKey?: string; to?: string }): string[] {
  const channel = ctx.channelId ?? "unknown";
  const conversation = ctx.conversationId ?? event.to;
  return Array.from(
    new Set(
      [
        event.sessionKey,
        ctx.sessionKey,
        conversation ? `${channel}:${conversation}:none` : undefined,
        conversation ? `${channel}:${conversation}` : undefined,
        `${channel}:${conversation ?? "unknown"}`,
      ].filter((key): key is string => Boolean(key?.trim())),
    ),
  );
}

function getState(key: string): AutoAppendState {
  const state = sessionState.get(key) ?? { lastStickerAt: 0, messagesSinceSticker: Number.MAX_SAFE_INTEGER };
  sessionState.set(key, state);
  return state;
}

function channelAllowed(channels: string[], channelId?: string): boolean {
  return Boolean(channelId && channels.includes(channelId));
}

function toolChannelAllowed(channels: string[], ctx: OpenClawPluginToolContext): boolean {
  const channelId = ctx.deliveryContext?.channel ?? ctx.messageChannel;
  return !channelId || channels.includes(channelId);
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

function renderPendingStickerMediaUrls(pendingStickers: readonly PendingSticker[]): string[] {
  return pendingStickers.flatMap((sticker) => splitStickerMediaFromContent(renderSticker(sticker.name)).mediaUrls);
}

function normalizeStickerReplyPayload(params: {
  payload: ReplyPayloadLike;
  channelId?: string;
  sessionKey?: string | readonly string[];
  pluginConfig: unknown;
  mediaBasePath?: string;
  logger: OpenClawPluginApi["logger"];
}): { payload?: ReplyPayloadLike; reason?: string } {
  const config = resolveConfig(params.pluginConfig);
  const mediaBasePath = params.mediaBasePath ?? resolveRuntimeMediaBasePath(config.mediaBasePath);
  if (!config.enabled || !channelAllowed(config.channels, params.channelId)) {
    return {};
  }

  const originalText = String(params.payload.text ?? "");
  const sessionKeys = Array.isArray(params.sessionKey)
    ? params.sessionKey
    : params.sessionKey
      ? [params.sessionKey]
      : [`${params.channelId ?? "unknown"}:unknown`];
  const sessionKey = sessionKeys[0] ?? `${params.channelId ?? "unknown"}:unknown`;
  const pendingStickers = consumePendingStickers(sessionKeys);
  if (!originalText.trim() && pendingStickers.length === 0) {
    return {};
  }

  const state = getState(sessionKey);
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
    const mediaUrls = mergeMediaUrls(params.payload.mediaUrls, split.mediaUrls, mediaBasePath);
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

  if (pendingStickers.length > 0) {
    const pendingMediaUrls = renderPendingStickerMediaUrls(pendingStickers);
    const mediaUrls = mergeMediaUrls(params.payload.mediaUrls, pendingMediaUrls, mediaBasePath);
    state.lastStickerAt = Date.now();
    state.messagesSinceSticker = 0;
    const stickerNames = pendingStickers.map((sticker) => sticker.name).join(",");
    params.logger.info(`[claw-sticker] resolved tool stickers ${stickerNames} to payload mediaUrls`);
    return {
      reason: "tool",
      payload: {
        ...params.payload,
        text: content || undefined,
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
    const mediaUrls = mergeMediaUrls(params.payload.mediaUrls, split.mediaUrls, mediaBasePath);
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
  description: "Adds an agentic send_sticker tool with self-contained WeCom sticker delivery.",
  register(api: OpenClawPluginApi) {
    const compatibleApi = api as ToolCompatiblePluginApi;
    const resolveMediaBasePath = () =>
      resolveRuntimeMediaBasePath(resolveConfig(api.pluginConfig).mediaBasePath, { rootDir: api.rootDir });

    api.registerHostedMediaResolver?.((mediaUrl) => resolveHostedStickerMediaUrl(mediaUrl, resolveMediaBasePath()));

    if (resolveConfig(api.pluginConfig).assetSync.enabled) {
      void ensureStickerAssets(resolveMediaBasePath(), api.logger).catch((err: unknown) => {
        api.logger.warn(`[claw-sticker] failed to sync sticker assets: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    if (compatibleApi.registerTool) {
      compatibleApi.registerTool(
        (ctx) => {
          const config = resolveConfig(api.pluginConfig);
          if (!config.enabled || !config.tool.enabled || !toolChannelAllowed(config.channels, ctx)) {
            return null;
          }
          return createSendStickerTool(ctx);
        },
        { name: "send_sticker", optional: true },
      );
    } else if (resolveConfig(api.pluginConfig).tool.enabled) {
      api.logger.warn("[claw-sticker] send_sticker tool unavailable because this OpenClaw runtime does not expose registerTool");
    }

    api.on(
      "reply_payload_sending",
      async (event, ctx) => {
        const mediaBasePath = resolveMediaBasePath();
        let result: ReturnType<typeof normalizeStickerReplyPayload>;
        try {
          result = normalizeStickerReplyPayload({
            payload: event.payload,
            channelId: event.channel ?? ctx.channelId,
            sessionKey: getSessionKeys(ctx, event),
            pluginConfig: api.pluginConfig,
            mediaBasePath,
            logger: api.logger,
          });
          if (
            resolveConfig(api.pluginConfig).assetSync.enabled &&
            result.payload?.mediaUrls?.some((mediaUrl) => resolveHostedStickerMediaUrl(mediaUrl, mediaBasePath))
          ) {
            await ensureStickerAssets(mediaBasePath, api.logger);
          }
        } catch (err: unknown) {
          api.logger.warn(`[claw-sticker] reply payload hook failed; sending original payload: ${err instanceof Error ? err.message : String(err)}`);
          return undefined;
        }
        return result.payload ? { payload: result.payload } : undefined;
      },
      { priority: -50, timeoutMs: 1000 },
    );
  },
});

export default plugin;

export { appendSticker, decideAutoAppend, ensureStickerAssets, fixStickerFormat, normalizeStickerReplyPayload };
