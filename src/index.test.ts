import { describe, expect, it, vi } from "vitest";
import entry from "./index.js";

type Handler = (event: { content?: string; to?: string }, ctx: { channelId?: string; conversationId?: string; sessionKey?: string }) => Promise<unknown>;

function registerTestHandler(pluginConfig?: Record<string, unknown>) {
  let handler: Handler | undefined;
  const api = {
    pluginConfig,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    on: vi.fn((name: string, registered: Handler) => {
      if (name === "message_sending") {
        handler = registered;
      }
    }),
  };
  entry.register(api as never);
  if (!handler) {
    throw new Error("message_sending handler was not registered");
  }
  return { handler, api };
}

describe("plugin entry", () => {
  it("registers a message_sending hook", () => {
    const { api } = registerTestHandler();
    expect(api.on).toHaveBeenCalledWith("message_sending", expect.any(Function), {
      priority: -50,
      timeoutMs: 100,
    });
  });

  it("fixes sticker syntax on wecom", async () => {
    const { handler } = registerTestHandler({ autoAppend: { enabled: false } });
    await expect(
      handler({ content: "搞定了 MEDIA: stickers/v2/happy.png", to: "room-1" }, { channelId: "wecom", conversationId: "room-1" }),
    ).resolves.toEqual({ content: "搞定了\nMEDIA: stickers/v2/happy.png" });
  });

  it("does not run on other channels", async () => {
    const { handler } = registerTestHandler();
    await expect(
      handler({ content: "已完成，测试通过了。", to: "room-1" }, { channelId: "slack", conversationId: "room-1" }),
    ).resolves.toBeUndefined();
  });

  it("auto-appends conservatively when enabled", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const { handler } = registerTestHandler();
      await expect(
        handler({ content: "已完成，测试通过了。", to: "room-2" }, { channelId: "wecom", conversationId: "room-2" }),
      ).resolves.toEqual({ content: expect.stringContaining("MEDIA: stickers/v2/") });
    } finally {
      random.mockRestore();
    }
  });
});
