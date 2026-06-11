import { describe, expect, it } from "vitest";
import { fixStickerFormat, splitStickerMediaFromContent } from "./format.js";

describe("fixStickerFormat", () => {
  it.each([
    ["搞定。\n\nMEDIA: stickers/happy.png", "搞定。\n\nMEDIA: stickers/happy.png"],
    ["搞定。\n\n📎 stickers/happy.png", "搞定。\n\nMEDIA: stickers/happy.png"],
    ["搞定。\n\n![](stickers/happy.png)", "搞定。\n\nMEDIA: stickers/happy.png"],
    ["搞定。\n\n![开心](stickers/happy.png)", "搞定。\n\nMEDIA: stickers/happy.png"],
    ["搞定。 MEDIA: stickers/happy.png", "搞定。\nMEDIA: stickers/happy.png"],
    ["搞定。\n\n  MEDIA: stickers/happy.png", "搞定。\n\nMEDIA: stickers/happy.png"],
    ["搞定。\n\nMEDIA: /root/.openclaw/workspace/stickers/happy.png", "搞定。\n\nMEDIA: stickers/happy.png"],
    ["搞定。\n\nMEDIA: /root/.openclaw/workspace/stickers/v2/happy.png", "搞定。\n\nMEDIA: stickers/happy.png"],
    ["[sticker:happy]", "MEDIA: stickers/happy.png"],
  ])("normalizes %s", (input, expected) => {
    expect(fixStickerFormat(input).content).toBe(expected);
  });

  it("passes through text without sticker syntax", () => {
    const input = "今天天气不错，没有任何表情";
    expect(fixStickerFormat(input)).toMatchObject({ content: input, changed: false, hasSticker: false });
  });

  it("does not rewrite examples inside fenced code blocks", () => {
    const input = "示例：\n```text\nMEDIA: stickers/happy.png\n```\n不要真的发送。";
    expect(fixStickerFormat(input).content).toBe(input);
  });

  it("removes unknown marker and unknown MEDIA control lines", () => {
    expect(fixStickerFormat("[sticker:evil]").content).toBe("");
    expect(fixStickerFormat("MEDIA: stickers/evil.png").content).toBe("");
  });

  it("splits valid sticker MEDIA lines into payload mediaUrls", () => {
    expect(splitStickerMediaFromContent("搞定。\nMEDIA: stickers/happy.png")).toEqual({
      text: "搞定。",
      mediaUrls: ["stickers/happy.png"],
      changed: true,
    });
  });
});
