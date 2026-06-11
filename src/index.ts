import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { appendSticker, decideAutoAppend, type AutoAppendState } from "./auto-append.js";
import { resolveConfig } from "./config.js";
import { contentHasSticker, fixStickerFormat } from "./format.js";

const sessionState = new Map<string, AutoAppendState>();

type ClawStickerPluginEntry = {
  id: string;
  name: string;
  description: string;
  configSchema: unknown;
  register(api: OpenClawPluginApi): void;
};

function getSessionKey(ctx: { sessionKey?: string; channelId?: string; conversationId?: string }, event: { to?: string }): string {
  return ctx.sessionKey ?? `${ctx.channelId ?? "unknown"}:${ctx.conversationId ?? event.to ?? "unknown"}`;
}

function getState(key: string): AutoAppendState {
  const state = sessionState.get(key) ?? { lastStickerAt: 0, messagesSinceSticker: Number.MAX_SAFE_INTEGER };
  sessionState.set(key, state);
  return state;
}

function channelAllowed(channels: string[], channelId?: string): boolean {
  return Boolean(channelId && channels.includes(channelId));
}

const plugin: ClawStickerPluginEntry = definePluginEntry({
  id: "claw-sticker",
  name: "Claw Sticker",
  description: "Adds conservative WeCom stickers and fixes MEDIA sticker format before delivery.",
  register(api: OpenClawPluginApi) {
    api.on(
      "message_sending",
      async (event, ctx) => {
        const config = resolveConfig(api.pluginConfig);
        if (!config.enabled || !channelAllowed(config.channels, ctx.channelId)) {
          return undefined;
        }

        const original = String(event.content ?? "");
        if (!original.trim()) {
          return undefined;
        }

        let content = original;
        const key = getSessionKey(ctx, event);
        const state = getState(key);

        if (config.formatGuard.enabled) {
          const fixed = fixStickerFormat(content);
          content = fixed.content;
          if (fixed.hasSticker || contentHasSticker(content)) {
            state.lastStickerAt = Date.now();
            state.messagesSinceSticker = 0;
            if (fixed.changed) {
              api.logger.info("[claw-sticker] format guard fixed sticker syntax");
              return { content };
            }
            return undefined;
          }
        }

        state.messagesSinceSticker += 1;
        const decision = decideAutoAppend({
          content,
          config: config.autoAppend,
          state,
        });

        if (decision.append) {
          const next = appendSticker(content, decision.sticker);
          state.lastStickerAt = Date.now();
          state.messagesSinceSticker = 0;
          api.logger.info(`[claw-sticker] appended ${decision.sticker} (${decision.reason})`);
          return { content: next };
        }

        if (decision.reason === "dry_run") {
          api.logger.info(`[claw-sticker] dry-run would append ${decision.sticker ?? "unknown"} (${decision.signal ?? "unknown"})`);
        }

        return content !== original ? { content } : undefined;
      },
      { priority: -50, timeoutMs: 100 },
    );
  },
});

export default plugin;

export { appendSticker, decideAutoAppend, fixStickerFormat };
