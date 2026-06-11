import { describe, expect, it, vi } from "vitest";
import entry from "./index.js";
import { normalizeStickerReplyPayload } from "./index.js";

type Handler = (
  event: { payload: { text?: string; mediaUrls?: string[] }; channel?: string; sessionKey?: string },
  ctx: { channelId?: string; conversationId?: string; sessionKey?: string },
) => Promise<unknown>;

function registerTestHandler(pluginConfig?: Record<string, unknown>) {
  let handler: Handler | undefined;
  let hostedMediaResolver: ((mediaUrl: string) => string | null | undefined | Promise<string | null | undefined>) | undefined;
  const api = {
    pluginConfig,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    registerHostedMediaResolver: vi.fn((resolver: typeof hostedMediaResolver) => {
      hostedMediaResolver = resolver;
    }),
    on: vi.fn((name: string, registered: Handler) => {
      if (name === "reply_payload_sending") {
        handler = registered;
      }
    }),
  };
  entry.register(api as never);
  if (!handler) {
    throw new Error("reply_payload_sending handler was not registered");
  }
  return { handler, api, hostedMediaResolver };
}

describe("plugin entry", () => {
  it("registers a reply_payload_sending hook", () => {
    const { api } = registerTestHandler();
    expect(api.registerHostedMediaResolver).toHaveBeenCalledWith(expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("reply_payload_sending", expect.any(Function), {
      priority: -50,
      timeoutMs: 100,
    });
  });

  it("resolves sticker marker into payload mediaUrls on wecom", async () => {
    const { handler } = registerTestHandler({ autoAppend: { enabled: false } });
    await expect(
      handler({ payload: { text: "[sticker:happy]" }, channel: "wecom", sessionKey: "room-1" }, { channelId: "wecom", conversationId: "room-1" }),
    ).resolves.toEqual({
      payload: {
        text: undefined,
        mediaUrl: "~/.openclaw/workspace/stickers/happy.png",
        mediaUrls: ["~/.openclaw/workspace/stickers/happy.png"],
      },
    });
  });

  it("fixes inline sticker syntax and strips MEDIA text from visible payload", async () => {
    const { handler } = registerTestHandler({ autoAppend: { enabled: false } });
    await expect(
      handler({ payload: { text: "搞定了 MEDIA: stickers/happy.png" }, channel: "wecom", sessionKey: "room-inline" }, { channelId: "wecom", conversationId: "room-inline" }),
    ).resolves.toEqual({
      payload: {
        text: "搞定了",
        mediaUrl: "~/.openclaw/workspace/stickers/happy.png",
        mediaUrls: ["~/.openclaw/workspace/stickers/happy.png"],
      },
    });
  });

  it("does not run on other channels", async () => {
    const { handler } = registerTestHandler();
    await expect(
      handler({ payload: { text: "已完成，测试通过了。" }, channel: "slack", sessionKey: "room-1" }, { channelId: "slack", conversationId: "room-1" }),
    ).resolves.toBeUndefined();
  });

  it("auto-appends conservatively when enabled", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const { handler } = registerTestHandler();
      await expect(
        handler({ payload: { text: "已完成，测试通过了。" }, channel: "wecom", sessionKey: "room-2" }, { channelId: "wecom", conversationId: "room-2" }),
      ).resolves.toEqual({
        payload: {
          text: "已完成，测试通过了。",
          mediaUrl: "~/.openclaw/workspace/stickers/happy.png",
          mediaUrls: ["~/.openclaw/workspace/stickers/happy.png"],
        },
      });
    } finally {
      random.mockRestore();
    }
  });

  it("normalizes payloads directly for unit-level debugging", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    expect(
      normalizeStickerReplyPayload({
        payload: { text: "[sticker:happy]" },
        channelId: "wecom",
        sessionKey: "debug-room",
        pluginConfig: { autoAppend: { enabled: false } },
        logger,
      }),
    ).toEqual({
      reason: "format_guard",
      payload: {
        text: undefined,
        mediaUrl: "~/.openclaw/workspace/stickers/happy.png",
        mediaUrls: ["~/.openclaw/workspace/stickers/happy.png"],
      },
    });
  });

  it("uses mediaBasePath for delivery URLs and hosted media resolution", async () => {
    const { handler, hostedMediaResolver } = registerTestHandler({
      autoAppend: { enabled: false },
      mediaBasePath: "/custom/openclaw/stickers",
    });

    await expect(
      handler({ payload: { text: "[sticker:happy]" }, channel: "wecom", sessionKey: "room-custom" }, { channelId: "wecom", conversationId: "room-custom" }),
    ).resolves.toEqual({
      payload: {
        text: undefined,
        mediaUrl: "/custom/openclaw/stickers/happy.png",
        mediaUrls: ["/custom/openclaw/stickers/happy.png"],
      },
    });
    expect(await hostedMediaResolver?.("stickers/happy.png")).toBe("/custom/openclaw/stickers/happy.png");
  });

  it("does not rewrite non-sticker mediaUrls with matching filenames", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    expect(
      normalizeStickerReplyPayload({
        payload: {
          text: "[sticker:happy]",
          mediaUrls: ["https://example.com/happy.png"],
        },
        channelId: "wecom",
        sessionKey: "existing-media-room",
        pluginConfig: { autoAppend: { enabled: false } },
        logger,
      }),
    ).toEqual({
      reason: "format_guard",
      payload: {
        text: undefined,
        mediaUrl: "https://example.com/happy.png",
        mediaUrls: [
          "https://example.com/happy.png",
          "~/.openclaw/workspace/stickers/happy.png",
        ],
      },
    });
  });
});
