import { describe, expect, it } from "vitest";
import { appendSticker, decideAutoAppend, isAutoAppendBlocked } from "./auto-append.js";

describe("decideAutoAppend", () => {
  const readyState = { lastStickerAt: 0, messagesSinceSticker: 99 };

  it("appends a success sticker for strong completion signals when probability passes", () => {
    const decision = decideAutoAppend({
      content: "已完成，我把配置更新好了。",
      state: { ...readyState },
      random: () => 0,
      now: 100_000_000,
    });
    expect(decision.append).toBe(true);
    if (decision.append) {
      expect(["happy", "love"]).toContain(decision.sticker);
      expect(decision.reason).toBe("task_success");
    }
  });

  it("supports minor failure and uncertain signals", () => {
    const failure = decideAutoAppend({
      content: "这里报错了，构建没有通过。",
      state: { ...readyState },
      random: () => 0,
      now: 100_000_000,
    });
    expect(failure.append).toBe(true);

    const uncertain = decideAutoAppend({
      content: "这个现象有点奇怪，我需要再确认一下。",
      state: { ...readyState },
      random: () => 0,
      now: 100_000_000,
    });
    expect(uncertain).toEqual({ append: true, sticker: "confused", reason: "uncertain" });
  });

  it("blocks serious or long technical content", () => {
    expect(isAutoAppendBlocked("线上事故已经恢复，但还有数据一致性风险。")).toBe(true);
    expect(isAutoAppendBlocked("```ts\nconsole.log('done')\n```")).toBe(true);
  });

  it("honors cooldown and probability", () => {
    expect(
      decideAutoAppend({
        content: "已完成，测试通过了。",
        state: { lastStickerAt: 99_999, messagesSinceSticker: 99 },
        random: () => 0,
        now: 100_000,
      }),
    ).toMatchObject({ append: false, reason: "cooldown" });

    expect(
      decideAutoAppend({
        content: "已完成，测试通过了。",
        state: { ...readyState },
        random: () => 0.99,
        now: 100_000_000,
      }),
    ).toMatchObject({ append: false, reason: "probability" });
  });

  it("renders a WeCom MEDIA line at the end", () => {
    expect(appendSticker("已完成。", "happy")).toBe("已完成。\n\nMEDIA: stickers/v2/happy.png");
  });
});
