import { describe, expect, it } from "vitest";
import { fixStickerFormat } from "./format.js";

describe("fixStickerFormat", () => {
  it.each([
    ["搞定。\n\nMEDIA: stickers/v2/happy.png", "搞定。\n\nMEDIA: stickers/v2/happy.png"],
    ["搞定。\n\n📎 stickers/v2/happy.png", "搞定。\n\nMEDIA: stickers/v2/happy.png"],
    ["搞定。\n\n![](stickers/v2/happy.png)", "搞定。\n\nMEDIA: stickers/v2/happy.png"],
    ["搞定。\n\n![开心](stickers/v2/happy.png)", "搞定。\n\nMEDIA: stickers/v2/happy.png"],
    ["搞定。 MEDIA: stickers/v2/happy.png", "搞定。\nMEDIA: stickers/v2/happy.png"],
    ["搞定。\n\n  MEDIA: stickers/v2/happy.png", "搞定。\n\nMEDIA: stickers/v2/happy.png"],
    ["搞定。\n\nMEDIA: /root/.openclaw/workspace/stickers/v2/happy.png", "搞定。\n\nMEDIA: stickers/v2/happy.png"],
    ["[sticker:happy]", "MEDIA: stickers/v2/happy.png"],
  ])("normalizes %s", (input, expected) => {
    expect(fixStickerFormat(input).content).toBe(expected);
  });

  it("passes through text without sticker syntax", () => {
    const input = "今天天气不错，没有任何表情";
    expect(fixStickerFormat(input)).toMatchObject({ content: input, changed: false, hasSticker: false });
  });

  it("does not rewrite examples inside fenced code blocks", () => {
    const input = "示例：\n```text\nMEDIA: stickers/v2/happy.png\n```\n不要真的发送。";
    expect(fixStickerFormat(input).content).toBe(input);
  });

  it("removes unknown marker and unknown MEDIA control lines", () => {
    expect(fixStickerFormat("[sticker:evil]").content).toBe("");
    expect(fixStickerFormat("MEDIA: stickers/v2/evil.png").content).toBe("");
  });
});
