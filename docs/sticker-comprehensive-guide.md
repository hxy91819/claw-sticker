# LightPilot 表情包完整指南

## 一、当前可用表情包（7 个）

路径：`/root/.openclaw/workspace/stickers/v2/`

| 文件名 | 大小 | 情绪 | 使用场景 |
|--------|------|------|---------|
| `happy.png` | 27KB | 开心 | 任务完成、好消息、被夸 |
| `love.png` | 27KB | 喜欢/感谢 | 感谢、表达喜爱 |
| `cool.png` | 31KB | 装酷/得瑟 | 自信满满、炫耀时（**仅限此场景**） |
| `confused.png` | 24KB | 困惑 | 遇到奇怪问题、不确定 |
| `nervous.png` | 28KB | 紧张/焦虑 | 等待结果、压力山大 |
| `sigh.png` | 24KB | 叹气/无奈 | 事情不顺利、累了 |
| `awkward.png` | 29KB | 尴尬 | 翻车了、社死时刻 |

## 二、使用规则

### 2.1 发送格式（铁律）

`MEDIA: stickers/v2/<name>.png` — **wecom（企业微信）通道特有指令**

**4 条铁律**：
1. `MEDIA:` 必须**单独一行**且**行首**（前面无空格、无文字、无 emoji）
2. 文字和 `MEDIA:` 各占**独立行**
3. 路径用**相对路径** `stickers/v2/<name>.png`
4. **禁用** `📎`、`![](...)`、`![name](path)` 等一切错误格式

### 2.2 自检口诀（每次发消息前默念）

```
有表情？ → 没有 → 过
         → 有 → MEDIA: 单独一行？行首无空格？路径对？
              → 全对 → 过
              → 任一错 → 重写
```

### 2.3 使用时机

- **适时使用**，不要每条消息都发
- **配合文字**，不单独发
- **认真干活时不发**，确认完成后可以带上
- **默认从 `happy, love` 里随机选**，不要用 cool
- **LLM "Lost in the Middle" 偏置**：中间的表情容易被遗忘，**置顶在回复末尾**更可靠

### 2.4 场景-表情映射表

| 场景 | 候选池 |
|------|--------|
| 任务完成 / 好消息 / 被夸 | happy, love |
| 收到 / 遵命 / 布置任务 | happy, cool |
| 遇到困难 / 无语 | sigh |
| 出错 / 翻车 | awkward, sigh |
| 困惑 / 思考 | confused |
| 紧张 / 焦虑 | nervous |
| **装酷 / 得瑟** | **cool（仅限此场景）** |

## 三、已被删除的表情（历史记录）

以下表情因**底部带文字水印、被裁剪、分辨率不足**等原因已被删除，等待重新生成高清版本：

| 文件名 | 原大小 | 删除原因 |
|--------|--------|---------|
| `celebrate.png` | 91KB | 底部可能带字 |
| `smug.png` | 94KB | — |
| `salute.png` | 105KB | — |
| `exhausted.png` | 93KB | 底部带 "exhausted" 文字 |
| `sleepy.png` | 83KB | 底部带文字 |
| `shocked.png` | 109KB | — |
| `facepalm.png` | 95KB | — |
| `eyeroll.png` | 87KB | — |
| `pray.png` | 98KB | — |
| `cool-girl.png` | 31KB | 和 cool.png 是同一个文件（重复） |

**计划新增的表情**：
- `angry.png` — 生气/着急
- `cute.png` — 卖萌/撒娇

## 四、自动化检查

### 4.1 验证脚本

路径：`/root/.openclaw/workspace/scripts/validate-media-format.py`

用法：
```bash
cat /tmp/msg.txt | python3 /root/.openclaw/workspace/scripts/validate-media-format.py
# 返回 0 = 可以发；返回 1 = 格式有错
```

### 4.2 插件（尝试中，尚未成功加载）

路径：`/projects/.openclaw/extensions/sticker-format-guard/`

原理：利用 OpenClaw 的 `message_sending` hook，在消息发送到 channel 前自动修正格式错误。

**问题**：OpenClaw 插件扫描路径只包含内置的 `dist/extensions/`，自定义插件目录未被扫描，且需要预编译为 JS bundle。当前方案卡在此处，待进一步开发。

## 五、常见错误 vs 正确写法

| 错误 ❌ | 正确 ✅ |
|--------|--------|
| `📎 stickers/v2/happy.png` | `MEDIA: stickers/v2/happy.png` |
| `![](stickers/v2/happy.png)` | `MEDIA: stickers/v2/happy.png` |
| `文字... MEDIA: stickers/...`（同行）| `文字...\n\nMEDIA: stickers/...`（分行） |
| `  MEDIA: stickers/...`（前面有空格）| `MEDIA: stickers/...` |
| `MEDIA: /root/.../stickers/...`（绝对路径）| `MEDIA: stickers/v2/...`（相对路径） |

## 六、文档引用

- **SOUL.md** — 人格定义文件（启动时加载），含表情包格式铁律和场景池
- **AGENTS.md** — 工作规则（启动时加载），含格式验证脚本引用和常见错误对照表
- **MEMORY.md** — 长期记忆（main session 加载），含日报表情选择规则
- **config/daily-report-template.md** — 日报模板，含表情选择映射
- **stickers/README.md** — 表情包库说明，含可用表情列表

## 七、技术备注

- `MEDIA:` 是 **wecom 通道特有**指令，其他 channel（Telegram/Discord）用 `message` tool 的 `filePath` 参数
- 表情包当前仅在 wecom（企业微信群聊）中使用
- 头像文件在 `docs/lightpilot-avatar.png`（1920KB），和表情包角色不统一，待重制
