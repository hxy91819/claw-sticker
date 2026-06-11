# Sticker Format Guard — OpenClaw Plugin 开发提示词

## 背景

OpenClaw agent (Eliy / LightPilot) 在发送消息时经常使用 `MEDIA: stickers/v2/<name>.png` 指令来发送表情包。但由于以下问题，格式经常出错：
- LLM 生成时混淆 `📎` emoji 图标
- Markdown 图片语法 `![](...)`
- `MEDIA:` 和文字混在同一行
- `MEDIA:` 前面有空格
- 使用绝对路径而非相对路径

## 目标

开发一个 **OpenClaw Plugin**，在消息发送到 channel 之前自动拦截并修正 `MEDIA:` 指令的格式错误。

---

## 技术方案

### Hook 选择

使用 `message_sending` 钩子（`api.on("message_sending", ...)`）：
- 在消息**即将发送给 channel** 时拦截
- 可以 rewrite `content` 内容
- 不修改其他正常文本

### 修正规则（按优先级顺序执行）

对 `event.content` 的每一行进行处理：

**规则 1：📎 格式 → MEDIA:**
- 匹配：行首是 `📎` 且包含 `stickers/`
- 操作：替换为 `MEDIA: stickers/v2/xxx.png`

**规则 2：Markdown 图片语法 → MEDIA:**
- 匹配：`![](stickers/v2/xxx.png)` 或 `![text](stickers/v2/xxx.png)`
- 操作：替换为 `MEDIA: stickers/v2/xxx.png`

**规则 3：文字和 MEDIA 同行 → 拆分**
- 匹配：`搞定。 MEDIA: stickers/v2/happy.png`
- 操作：拆成两行 —— 第一行保留文字，第二行是 `MEDIA: stickers/v2/happy.png`

**规则 4：MEDIA: 前面有空格 → 去掉空格**
- 匹配：`  MEDIA: stickers/v2/happy.png`（前面有若干空格）
- 操作：去掉前导空格，变成 `MEDIA: stickers/v2/happy.png`

**规则 5：绝对路径 → 相对路径**
- 匹配：`MEDIA: /root/.openclaw/workspace/stickers/v2/happy.png`
- 操作：提取 `stickers/` 后面的部分，改成 `MEDIA: stickers/v2/happy.png`

### 安全约束

- **只修正格式，不改其他内容** — 不删除文字、不修改非表情内容
- **如果 content 里没有表情相关的东西，直接 pass through**
- **支持 wecom / 企微 / 微信等多个 channel**
- **高优先级（priority: 100）**，让其他 message_sending 钩子先看到修正后的内容

---

## 代码实现（TypeScript / JavaScript）

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

function fixStickerFormat(content: string): string {
  const lines = content.split("\n");
  const resultLines: string[] = [];
  let modified = false;

  for (const line of lines) {
    const stripped = line.trim();

    // Fix 1: 📎 stickers/... → MEDIA: stickers/...
    if (stripped.startsWith("📎") && stripped.includes("stickers/")) {
      const path = stripped.replace("📎", "").trim();
      resultLines.push(`MEDIA: ${path}`);
      modified = true;
      continue;
    }

    // Fix 2: Markdown image syntax ![](stickers/...)
    const mdMatch = stripped.match(/^!?\[.*?\]\((stickers\/.*\.png)\)$/);
    if (mdMatch) {
      resultLines.push(`MEDIA: ${mdMatch[1]}`);
      modified = true;
      continue;
    }

    // Fix 3: Inline MEDIA: with text → split
    const inlineMatch = line.match(/^(.*?)\s*(MEDIA:\s*stickers\/.*\.png)\s*$/);
    if (inlineMatch && inlineMatch[1].trim()) {
      resultLines.push(inlineMatch[1].trim());
      resultLines.push(inlineMatch[2].trim());
      modified = true;
      continue;
    }

    // Fix 4: Leading spaces before MEDIA:
    if (/^\s+MEDIA:\s*stickers\//.test(line)) {
      const mediaMatch = line.match(/^(\s*)(MEDIA:\s*stickers\/.*\.png)\s*$/);
      if (mediaMatch) {
        resultLines.push(mediaMatch[2].trim());
        modified = true;
        continue;
      }
    }

    // Fix 5: Absolute path → relative
    if (/^MEDIA:\s*\//.test(stripped)) {
      const absMatch = stripped.match(/^MEDIA:\s*(\/.*stickers\/.*\.png)\s*$/);
      if (absMatch) {
        const parts = absMatch[1].split("stickers/");
        const relPath = parts.length > 1 ? "stickers/" + parts[parts.length - 1] : absMatch[1];
        resultLines.push(`MEDIA: ${relPath}`);
        modified = true;
        continue;
      }
    }

    // Default: keep as-is
    resultLines.push(line);
  }

  return modified ? resultLines.join("\n") : content;
}

export default definePluginEntry({
  id: "sticker-format-guard",
  name: "Sticker Format Guard",
  description: "Auto-correct sticker MEDIA: format before message delivery",
  register(api) {
    api.on(
      "message_sending",
      async (event) => {
        const content = event.content;
        if (!content) return;

        const fixed = fixStickerFormat(content);
        if (fixed !== content) {
          console.log("[StickerFormatGuard] Fixed sticker format");
          return { content: fixed };
        }
      },
      { priority: 100 }
    );
  },
});
```

---

## 测试用例

| 输入 | 期望输出 |
|------|---------|
| `搞定。\n\nMEDIA: stickers/v2/happy.png` | 不变（正确格式） |
| `搞定。\n\n📎 stickers/v2/happy.png` | `搞定。\n\nMEDIA: stickers/v2/happy.png` |
| `搞定。\n\n![](stickers/v2/happy.png)` | `搞定。\n\nMEDIA: stickers/v2/happy.png` |
| `搞定。 MEDIA: stickers/v2/happy.png` | `搞定。\nMEDIA: stickers/v2/happy.png` |
| `搞定。\n\n  MEDIA: stickers/v2/happy.png` | `搞定。\n\nMEDIA: stickers/v2/happy.png` |
| `搞定。\n\nMEDIA: /root/stickers/v2/happy.png` | `搞定。\n\nMEDIA: stickers/v2/happy.png` |
| `今天天气不错，没有任何表情` | 不变（无表情） |
| `📎 stickers/v2/celebrate.png` | `MEDIA: stickers/v2/celebrate.png` |

---

## 部署说明

1. 插件代码编译为 CommonJS 或 ESM bundle
2. 放入 OpenClaw 的插件扫描目录（如 `dist/extensions/sticker-format-guard/`）
3. 在 `openclaw.json` 的 `plugins.entries` 中注册：`"sticker-format-guard": { "enabled": true }`
4. 确保在 `plugins.allow` 列表中也有 `"sticker-format-guard"`
5. 重启 Gateway 加载插件

---

## 为什么不用 `before_message_write` 或其他钩子

- `message_sending` 是最佳时机 —— 在消息即将发给 channel 时拦截，此时 content 已完全生成但还没有网络传输
- `before_message_write` 是更底层的消息写入 hook，可能不影响 channel 发送
- `before_dispatch` 太早，可能错过最终格式化
