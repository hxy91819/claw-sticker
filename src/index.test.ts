import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import entry from "./index.js";
import { normalizeStickerReplyPayload } from "./index.js";
import { resetPendingStickersForTest } from "./tool.js";

const testPluginRoot = "/tmp/openclaw-state/extensions/claw-sticker";
const testStickerPath = "/tmp/openclaw-state/workspace/stickers/happy.png";

type Handler = (
  event: { payload: { text?: string; mediaUrls?: string[] }; channel?: string; sessionKey?: string },
  ctx: { channelId?: string; conversationId?: string; sessionKey?: string },
) => Promise<unknown>;

type ToolFactory = (ctx: {
  sessionKey?: string;
  messageChannel?: string;
  deliveryContext?: { channel?: string; to?: string; threadId?: string | number };
}) => {
  name: string;
  execute(toolCallId: string, params: unknown): Promise<unknown>;
} | null;

beforeEach(() => {
  vi.stubEnv("OPENCLAW_STATE_DIR", "");
});

afterEach(() => {
  resetPendingStickersForTest();
  vi.unstubAllEnvs();
});

function registerTestHandler(pluginConfig?: Record<string, unknown>) {
  let handler: Handler | undefined;
  let toolFactory: ToolFactory | undefined;
  let hostedMediaResolver: ((mediaUrl: string) => string | null | undefined | Promise<string | null | undefined>) | undefined;
  const api = {
    rootDir: testPluginRoot,
    pluginConfig,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    registerHostedMediaResolver: vi.fn((resolver: typeof hostedMediaResolver) => {
      hostedMediaResolver = resolver;
    }),
    registerTool: vi.fn((factory: ToolFactory) => {
      toolFactory = factory;
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
  if (!toolFactory) {
    throw new Error("send_sticker tool factory was not registered");
  }
  return { handler, api, hostedMediaResolver, toolFactory };
}

describe("plugin entry", () => {
  it("registers a reply_payload_sending hook", () => {
    const { api } = registerTestHandler();
    expect(api.registerHostedMediaResolver).toHaveBeenCalledWith(expect.any(Function));
    expect(api.registerTool).toHaveBeenCalledWith(expect.any(Function), {
      name: "send_sticker",
      optional: true,
    });
    expect(api.on).toHaveBeenCalledWith("reply_payload_sending", expect.any(Function), {
      priority: -50,
      timeoutMs: 1000,
    });
  });

  it("keeps the payload hook available on runtimes without registerTool", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const on = vi.fn();
    const api = {
      rootDir: testPluginRoot,
      pluginConfig: {},
      logger,
      registerHostedMediaResolver: vi.fn(),
      on,
    };

    expect(() => entry.register(api as never)).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      "[claw-sticker] send_sticker tool unavailable because this OpenClaw runtime does not expose registerTool",
    );
    expect(on).toHaveBeenCalledWith("reply_payload_sending", expect.any(Function), {
      priority: -50,
      timeoutMs: 1000,
    });
  });

  it("resolves sticker marker into payload mediaUrls on wecom", async () => {
    const { handler } = registerTestHandler({ autoAppend: { enabled: false } });
    await expect(
      handler({ payload: { text: "[sticker:happy]" }, channel: "wecom", sessionKey: "room-1" }, { channelId: "wecom", conversationId: "room-1" }),
    ).resolves.toEqual({
      payload: {
        text: undefined,
        mediaUrl: testStickerPath,
        mediaUrls: [testStickerPath],
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
        mediaUrl: testStickerPath,
        mediaUrls: [testStickerPath],
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
      const { handler } = registerTestHandler({ autoAppend: { enabled: true } });
      await expect(
        handler({ payload: { text: "已完成，测试通过了。" }, channel: "wecom", sessionKey: "room-2" }, { channelId: "wecom", conversationId: "room-2" }),
      ).resolves.toEqual({
        payload: {
          text: "已完成，测试通过了。",
          mediaUrl: testStickerPath,
          mediaUrls: [testStickerPath],
        },
      });
    } finally {
      random.mockRestore();
    }
  });

  it("does not auto-append by default because stickers are tool-driven", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const { handler } = registerTestHandler();
      await expect(
        handler({ payload: { text: "已完成，测试通过了。" }, channel: "wecom", sessionKey: "room-default-auto" }, { channelId: "wecom", conversationId: "room-default-auto" }),
      ).resolves.toBeUndefined();
    } finally {
      random.mockRestore();
    }
  });

  it("queues a sticker through the tool and attaches it during final reply delivery", async () => {
    const { handler, toolFactory } = registerTestHandler();
    const tool = toolFactory({ sessionKey: "room-tool", messageChannel: "wecom" });

    await expect(tool?.execute("tool-1", { name: "happy", reason: "task_success" })).resolves.toEqual({
      content: [{ type: "text", text: "Queued sticker: happy\nMEDIA: stickers/happy.png" }],
      details: {
        queued: true,
        sticker: "happy",
        reason: "task_success",
        mediaLine: "MEDIA: stickers/happy.png",
        sessionKeys: ["room-tool"],
      },
    });
    await expect(
      handler({ payload: { text: "搞定了。" }, channel: "wecom", sessionKey: "room-tool" }, { channelId: "wecom", conversationId: "room-tool" }),
    ).resolves.toEqual({
      payload: {
        text: "搞定了。",
        mediaUrl: testStickerPath,
        mediaUrls: [testStickerPath],
      },
    });
  });

  it("queues multiple stickers through the tool and attaches them to the next reply", async () => {
    const { handler, toolFactory } = registerTestHandler();
    const tool = toolFactory({ sessionKey: "room-tool-multi", messageChannel: "wecom" });

    await tool?.execute("tool-1", { name: "happy" });
    await tool?.execute("tool-2", { name: "cool" });
    await tool?.execute("tool-3", { name: "love" });
    await tool?.execute("tool-4", { name: "confused" });

    await expect(
      handler({ payload: { text: "都发一下。" }, channel: "wecom", sessionKey: "room-tool-multi" }, { channelId: "wecom", conversationId: "room-tool-multi" }),
    ).resolves.toEqual({
      payload: {
        text: "都发一下。",
        mediaUrl: testStickerPath,
        mediaUrls: [
          testStickerPath,
          "/tmp/openclaw-state/workspace/stickers/cool.png",
          "/tmp/openclaw-state/workspace/stickers/love.png",
          "/tmp/openclaw-state/workspace/stickers/confused.png",
        ],
      },
    });

    await expect(
      handler({ payload: { text: "下一条不重复。" }, channel: "wecom", sessionKey: "room-tool-multi" }, { channelId: "wecom", conversationId: "room-tool-multi" }),
    ).resolves.toBeUndefined();
  });

  it("matches queued stickers when tool and reply hooks use different session key shapes", async () => {
    const { handler, toolFactory } = registerTestHandler();
    const tool = toolFactory({
      messageChannel: "wecom",
      deliveryContext: { channel: "wecom", to: "room-route" },
    });

    await tool?.execute("tool-route", { name: "happy" });

    await expect(
      handler(
        { payload: { text: "route key works." }, channel: "wecom", sessionKey: "agent:main:wecom:group:room-route" },
        { channelId: "wecom", conversationId: "room-route" },
      ),
    ).resolves.toEqual({
      payload: {
        text: "route key works.",
        mediaUrl: testStickerPath,
        mediaUrls: [testStickerPath],
      },
    });
  });

  it("does not block the original reply when sticker asset sync fails", async () => {
    const { handler, api } = registerTestHandler({
      autoAppend: { enabled: false },
      mediaBasePath: "/dev/null/stickers",
    });

    await expect(
      handler(
        { payload: { text: "正文必须继续发送。\nMEDIA: stickers/happy.png" }, channel: "wecom", sessionKey: "room-sync-fail" },
        { channelId: "wecom", conversationId: "room-sync-fail" },
      ),
    ).resolves.toBeUndefined();
    expect(api.logger.warn).toHaveBeenCalledWith(expect.stringContaining("[claw-sticker] reply payload hook failed; sending original payload:"));
  });

  it("can deliver a queued sticker even when the final reply text is empty", async () => {
    const { handler, toolFactory } = registerTestHandler();
    const tool = toolFactory({ sessionKey: "room-tool-empty", messageChannel: "wecom" });

    await tool?.execute("tool-1", { name: "cool" });
    await expect(
      handler({ payload: { text: "" }, channel: "wecom", sessionKey: "room-tool-empty" }, { channelId: "wecom", conversationId: "room-tool-empty" }),
    ).resolves.toEqual({
      payload: {
        text: undefined,
        mediaUrl: "/tmp/openclaw-state/workspace/stickers/cool.png",
        mediaUrls: ["/tmp/openclaw-state/workspace/stickers/cool.png"],
      },
    });
  });

  it("does not expose the sticker tool for disallowed channels", () => {
    const { toolFactory } = registerTestHandler();
    expect(toolFactory({ sessionKey: "room-slack", messageChannel: "slack" })).toBeNull();
  });

  it("normalizes payloads directly for unit-level debugging", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    expect(
      normalizeStickerReplyPayload({
        payload: { text: "[sticker:happy]" },
        channelId: "wecom",
        sessionKey: "debug-room",
        pluginConfig: { autoAppend: { enabled: false } },
        mediaBasePath: "/tmp/openclaw-state/workspace/stickers",
        logger,
      }),
    ).toEqual({
      reason: "format_guard",
      payload: {
        text: undefined,
        mediaUrl: testStickerPath,
        mediaUrls: [testStickerPath],
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
        mediaBasePath: "/tmp/openclaw-state/workspace/stickers",
        logger,
      }),
    ).toEqual({
      reason: "format_guard",
      payload: {
        text: undefined,
        mediaUrl: "https://example.com/happy.png",
        mediaUrls: [
          "https://example.com/happy.png",
          testStickerPath,
        ],
      },
    });
  });
});
