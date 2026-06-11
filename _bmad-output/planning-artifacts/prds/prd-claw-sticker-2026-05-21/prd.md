---
title: "Claw Sticker — OpenClaw 表情包插件"
status: draft
created: 2026-05-21
updated: 2026-05-21
---

# PRD: Claw Sticker

## 0. 文档目的

本 PRD 面向插件开发者和 OpenClaw 社区贡献者，定义 **claw-sticker** 插件的 V1 产品需求。插件包含两个核心能力：通过 prompt 引导 Agent 在合适的语境下自然地发送表情包，以及在消息发出前自动修正格式错误。本文档以功能分组、FR 全局编号的方式组织，`[ASSUMPTION]` 标记处为推断内容。技术实现细节参见 `docs/sticker-format-guard-plugin-prompt.md` 和 `docs/sticker-comprehensive-guide.md`。

## 1. 愿景

OpenClaw Agent 在企业微信等 IM 场景中与用户交互时，纯文字回复缺乏温度。表情包是让 Agent 表现得"更像人"的低成本方式——但 LLM 生成的表情指令格式五花八门（`📎`、Markdown 图片语法、路径错误等），导致表情包频繁发送失败。

**Claw Sticker** 是一个 OpenClaw 社区插件，从两个层面解决这个问题：**引导层**在会话建立时注入表情包使用指南和场景映射，让 LLM 在正确的语境下选择合适的表情，并以一定随机性决定是否发送，避免机械感；**兜底层**在消息到达 channel 之前拦截并自动修正所有已知的格式错误，确保即使 LLM "写错了"，用户依然能看到正确的表情包。

V1 聚焦企业微信（WeCom）通道，内置 7 个预设表情包，全部参数 hardcode。后续版本将支持用户自定义表情包和更多 channel。

## 2. 目标用户

### 2.1 主要用户画像

运行 OpenClaw Agent 并通过企业微信与团队/客户交互的 **OpenClaw 运营者（Operator）**。他们希望 Agent 的回复更有人情味，但不想手动处理表情包格式问题。技术上能完成 `openclaw plugins install` 的操作，但不一定能自己写插件。

### 2.2 Jobs To Be Done

- **功能性**：我希望 Agent 能在合适的时候发表情包，让对话不那么生硬
- **功能性**：我不想因为 LLM 格式错误导致表情包发送失败，看到一堆乱码
- **情感性**：我希望 Agent 表现得自然、像真人，而不是一个机械地每次都发表情的机器
- **情境性**：我在企业微信群里用 Agent 处理日常工作，表情包让沟通氛围更轻松

### 2.3 V1 非目标用户

- 使用 Telegram、Discord、Signal 等非 WeCom 通道的运营者
- 需要自定义表情包（上传自己的贴纸）的用户
- 需要精细调控表情参数（概率、冷却时间等）的高级用户

### 2.4 关键用户旅程

- **UJ-1. Operator 安装插件后 Agent 自然发送表情包。**
  Operator 通过 `openclaw plugins install` 安装 claw-sticker 并启用。Agent 在企业微信中正常回复用户消息时，完成一个任务后在回复末尾附上一个 `happy.png` 表情。下一次完成任务时，Agent 没有发表情——这是正常的，因为不是每次都发。用户感觉 Agent 有个性但不刻意。

- **UJ-2. Agent 生成了错误格式的表情指令，插件自动修正。**
  Agent 回复中写了 `📎 stickers/v2/happy.png`（错误格式）。插件在消息发送到企业微信之前拦截，自动修正为 `MEDIA: stickers/v2/happy.png`。用户在企业微信中看到的是正确渲染的表情包，无感知修正过程。

## 3. 术语表

- **Sticker（表情包）** — 插件内置的 PNG 图片，通过 `MEDIA:` 指令在 WeCom 通道中渲染为表情包。V1 共 7 个。
- **MEDIA 指令** — WeCom 通道特有的媒体发送格式：`MEDIA: stickers/v2/<name>.png`，必须独占一行、行首无空格、使用相对路径。
- **Format Guard（格式守卫）** — `message_sending` hook 中的格式修正逻辑，拦截并修正已知的 MEDIA 指令格式错误。
- **Prompt Guidance（Prompt 引导）** — 通过会话级机制注入 system context，引导 LLM 正确使用表情包。
- **Cooldown（冷却）** — 防止连续消息都携带表情包的时间/消息窗口机制。
- **Scene-Sticker Mapping（场景-表情映射）** — 定义哪些对话语境适合发送哪些表情的映射表。
- **Operator（运营者）** — 部署和运行 OpenClaw 实例的管理员，是插件的直接安装者和配置者。

## 4. 功能

### 4.1 Prompt 引导（Sticker Prompt Guidance）

**描述：** 在会话建立时向 Agent 的 system context 注入表情包使用指南。指南包含：可用表情包列表及其情绪标签、场景-表情映射表、MEDIA 指令格式铁律、使用时机原则（配合文字、不单独发、认真干活时不发）、以及"不必每次都发"的自然感要求。这是**引导层**——从源头减少格式错误和不恰当使用。实现 UJ-1。

**功能需求：**

#### FR-1: 会话级注入表情包使用指南

插件在会话新建时一次性注入结构化的表情包使用指南到 Agent 的 system context 中，后续 turn 不重复注入。`[ASSUMPTION: 使用 registerMemoryPromptSupplement 等会话级机制实现，具体 API 选择在架构设计阶段确认。注意：agentPromptGuidance 是 registerCommand 级别的属性，挂载在命令上而非插件全局，不适合作为 always-on 的静态注入方案]`

**可测试结果：**
- 启用插件后，Agent 首次回复即表现出对表情包列表和使用规则的认知（例如：在匹配场景下使用正确的 `MEDIA:` 格式和合适的表情名称）
- 在同一会话的后续 turn 中，Agent 持续表现出一致的表情包使用行为，无需重复引导
- 通过 Gateway 日志或 prompt 调试工具可确认指南文本出现在 system context 中
- 指南内容为静态文本，不依赖外部请求

#### FR-2: 场景-表情映射表

指南中包含场景到候选表情的映射关系，Agent 根据当前对话语境从候选池中选择。

**可测试结果：**
- 映射表覆盖以下场景：任务完成/好消息/被夸 → happy, love；收到/遵命 → happy, cool；遇到困难/无语 → sigh；出错/翻车 → awkward, sigh；困惑/思考 → confused；紧张/焦虑 → nervous；装酷/得瑟 → cool（仅限此场景）
- **默认表情池**：当对话语境不强烈匹配任何特定场景时，默认从 {happy, love} 中选择，不使用 cool
- `cool` 表情只在"装酷/得瑟"场景出现于候选池中

#### FR-3: 自然感引导

指南中明确要求 Agent 不要每次都发表情包，并给出行为约束。

**可测试结果：**
- 指南包含"不必每次都发表情"的明确指示
- 指南包含"认真干活时不发，确认完成后可以带上"的时机原则
- 指南包含"配合文字，不单独发表情"的搭配原则
- 指南要求表情包置于回复末尾

**Notes：** Prompt 引导的效果依赖 LLM 的指令遵从能力。不同模型的遵从度可能有差异，Format Guard 作为兜底层覆盖这一风险。

### 4.2 格式守卫（Sticker Format Guard）

**描述：** 通过 `message_sending` hook 在消息到达 WeCom channel 之前拦截并修正所有已知的 MEDIA 指令格式错误。格式修正是**通用的**——不仅覆盖插件内置的 7 个表情包，也修正任何符合 `stickers/` 路径模式的 MEDIA 指令（包括未来新增的表情或任意文件名）。这是**兜底层**——无论 LLM 怎么写错，用户端看到的都是正确格式。高优先级执行（`priority: 100`），确保下游 hook 看到的是修正后的内容。实现 UJ-2。

**Notes：** 选择 `message_sending` 而非 `before_message_write`（更底层的写入 hook，可能不影响 channel 发送）或 `before_dispatch`（时机太早，可能错过最终格式化）。`message_sending` 在消息即将发给 channel 时拦截，此时 content 已完全生成但还没有网络传输，是修正格式的最佳时机。

**功能需求：**

#### FR-4: 📎 格式修正

将 `📎 stickers/v2/<name>.png` 格式转换为标准 `MEDIA:` 指令。

**可测试结果：**
- 输入 `📎 stickers/v2/happy.png` → 输出 `MEDIA: stickers/v2/happy.png`
- 仅匹配行首为 `📎` 且包含 `stickers/` 的行

#### FR-5: Markdown 图片语法修正

将 `![](stickers/...)` 或 `![text](stickers/...)` 格式转换为标准 `MEDIA:` 指令。

**可测试结果：**
- 输入 `![](stickers/v2/happy.png)` → 输出 `MEDIA: stickers/v2/happy.png`
- 输入 `![开心](stickers/v2/happy.png)` → 输出 `MEDIA: stickers/v2/happy.png`

#### FR-6: 文字与 MEDIA 同行拆分

将同一行中混合的文字和 MEDIA 指令拆分为独立行。

**可测试结果：**
- 输入 `搞定。 MEDIA: stickers/v2/happy.png` → 输出 `搞定。\nMEDIA: stickers/v2/happy.png`
- 文字部分保留完整，不丢失内容

#### FR-7: 前导空格清除

去除 `MEDIA:` 指令前的多余空格。

**可测试结果：**
- 输入 `  MEDIA: stickers/v2/happy.png` → 输出 `MEDIA: stickers/v2/happy.png`

#### FR-8: 绝对路径转相对路径

将绝对路径的 MEDIA 指令转换为相对路径。

**可测试结果：**
- 输入 `MEDIA: /root/.openclaw/workspace/stickers/v2/happy.png` → 输出 `MEDIA: stickers/v2/happy.png`
- 以 `stickers/` 为分割点提取相对路径

#### FR-9: 安全约束

格式修正只影响表情相关内容，不修改其他文本。

**可测试结果：**
- 不包含表情相关内容的消息原样通过，零修改
- 包含表情的消息中，非表情行内容保持不变
- 修正规则按 FR-4 → FR-5 → FR-6 → FR-7 → FR-8 优先级顺序执行

### 4.3 随机性与冷却（Natural Randomness & Cooldown）

**描述：** 通过静态指南和动态状态两层配合，让 Agent 的表情包使用模式接近真人。静态指南（FR-1 中已注入）告知 Agent "不必每次都发"；动态冷却机制追踪 session 内近期表情发送情况，在需要时通过 per-turn 注入抑制信号。即使语境匹配，也不一定每次都发；连续多条消息不会都带表情。这是"像人"的关键。实现 UJ-1。

**功能需求：**

#### FR-10: 概率性触发引导

静态指南（FR-1）中包含概率性发送的指示，让 Agent 自行判断是否在本次回复中使用表情。

**可测试结果：**
- 指南中明确告知 Agent：即使场景匹配，也应该只在部分情况下发送表情 `[ASSUMPTION: 具体表述为"大约 30%-50% 的匹配场景下考虑发送"，而非精确概率控制]`
- 同一场景的连续触发中，Agent 不会每次都发表情

#### FR-11: 冷却窗口机制

通过 session 级状态跟踪最近的表情发送记录，在冷却窗口内通过动态注入向 Agent 发出抑制信号。

**可测试结果：**
- `[ASSUMPTION: 在 message_sending hook 中记录"本次消息包含表情"到 session 级状态（如 registerSessionExtension）；通过 enqueueNextTurnInjection（精确一次 per-turn 注入）或 before_prompt_build 读取该状态，若处于冷却窗口内则注入"最近已发过表情，本次不要发"的动态指示。enqueueNextTurnInjection 语义上更匹配（恰好一次、用完即弃），具体选择在架构设计阶段确认]`
- `[ASSUMPTION: 冷却窗口为最近 5 条消息内最多触发 1 次表情发送]`
- 冷却窗口内，Format Guard 仍然正常工作（如果消息中恰好有 MEDIA 指令照常修正格式），冷却仅影响 prompt 引导层的建议频率
- 冷却窗口期过后，Agent 恢复正常的概率性表情发送

### 4.4 内置表情包资源

**描述：** 插件打包时内置 7 个 PNG 表情包文件，安装后自动可用，无需运营者手动放置文件。

**功能需求：**

#### FR-12: 内置表情包集

插件包含 7 个预设表情包，覆盖常见对话情绪。

**可测试结果：**
- 插件包内含以下文件：`happy.png`、`love.png`、`cool.png`、`confused.png`、`nervous.png`、`sigh.png`、`awkward.png`
- 每个文件为合格的 PNG 图片，可在 WeCom 中正常渲染

#### FR-13: 资源部署

插件安装时将表情包文件部署到 OpenClaw 可访问的路径。

**可测试结果：**
- `[ASSUMPTION: 安装后表情包位于 OpenClaw workspace 的 stickers/v2/ 目录下，与现有 MEDIA 指令路径一致]`
- Agent 使用 `MEDIA: stickers/v2/<name>.png` 即可正确引用

## 5. 明确非目标

- **不做多 channel 适配** — V1 仅支持 WeCom 的 `MEDIA:` 指令格式。Telegram/Discord 等 channel 使用不同的媒体发送机制（`filePath` 参数），不在本版本范围内。
- **不做用户自定义表情包** — V1 表情包集为插件内置，运营者无法上传或替换。
- **不做可配置参数** — V1 所有行为参数（概率、冷却窗口、场景映射）hardcode，不暴露 operator 配置项。
- **不做表情包生成** — 不集成 AI 图片生成能力来动态创建表情包。
- **不做对话内容分析** — 冷却机制基于消息计数，不做语义级别的对话情绪分析。
- **不修改非表情内容** — Format Guard 严格限定在 MEDIA 指令相关行，不触碰其他文本。

## 6. MVP 范围

### 6.1 包含

- Prompt 引导：注入表情包使用指南（列表、映射、格式规则、自然感约束）
- 格式守卫：5 条修正规则全部实现
- 冷却机制：基于 session 级状态的连续发送抑制
- 内置 7 个表情包资源
- 完整的 `openclaw.plugin.json` manifest 和 `package.json` 配置
- clawhub 发布

### 6.2 MVP 之外

- 多 channel 支持（V2 — 需要抽象 channel-specific 的媒体发送机制）
- 用户自定义表情包上传（V2）
- Operator 可配置参数：概率、冷却窗口、启用/禁用单项功能（V2）
- 表情包使用统计和分析面板（V2+）
- 更多表情包：`angry.png`、`cute.png` 等计划新增的表情（待素材就绪后追加） `[NON-GOAL for MVP]`

## 7. 成功指标

**Primary**

- **SM-1**: 格式修正成功率 — 所有已知格式错误类型（FR-4 至 FR-8）100% 修正为合法 `MEDIA:` 指令。验证 FR-4, FR-5, FR-6, FR-7, FR-8。
- **SM-2**: 零误伤率 — 非表情内容不被修改或丢失。验证 FR-9。

**Secondary**

- **SM-3**: 表情包实际渲染率 — 启用插件后，Agent 回复中包含的 MEDIA 指令在 WeCom 端渲染为表情包的比率 ≥ 95%。验证 FR-1, FR-12, FR-13。
- **SM-4**: 自然感主观评估 — 安装者在连续使用一周后，不认为 Agent 发表情的频率"机械"或"烦人"。验证 FR-3, FR-10, FR-11。

**Counter-metrics（不应过度优化）**

- **SM-C1**: 表情发送频率 — 不应为了提高 SM-3 而增加发送频率。频率过高会损害 SM-4 的自然感。反制 SM-3。
- **SM-C2**: Prompt 引导长度 — 不应为了提高指令遵从度而无限扩展 system context 注入量。过长的注入会挤占 Agent 的有效 context window。反制 SM-1。

## 8. 跨域非功能需求

### 8.1 性能

- Format Guard hook 处理延迟 < 5ms（纯字符串操作，无网络调用）
- Prompt Guidance 注入为静态文本拼接，延迟可忽略
- 冷却机制使用内存级 session 状态，无持久化开销

### 8.2 可靠性

- Format Guard 遵循"fail-open"原则：如果修正逻辑自身出错，消息应原样通过，不阻塞发送
- 插件崩溃不影响 OpenClaw Gateway 主进程

### 8.3 可观测性

- Format Guard 每次修正时输出结构化日志（修正类型、原始片段、修正结果），便于运营者排查问题
- 日志使用 `api.logger` 的 `info` 级别，不产生额外的外部依赖

### 8.4 兼容性

- 遵循 OpenClaw Plugin SDK 当前 API 版本（`openclaw/plugin-sdk/plugin-entry`）
- 冷却机制的 prompt 注入类 hook 需要 operator 在插件配置中启用 `allowConversationAccess` 和/或 `allowPromptInjection`
- 插件 manifest 中需声明此要求，安装文档中需明确说明

## 9. 插件打包与分发

- 插件 ID：`claw-sticker`，需完整的 `openclaw.plugin.json` manifest，`activation.onStartup: true`
- 源码 TypeScript，构建为 ESM bundle，通过 `clawhub package publish` 发布
- 安装方式：`openclaw plugins install clawhub:openclaw/claw-sticker`
- 运营者需在 Gateway 配置中启用插件并授权 prompt 注入相关权限（`allowConversationAccess`、`allowPromptInjection`），否则引导和冷却功能将静默失效 `[ASSUMPTION: 最终所需的权限标志取决于架构阶段选定的具体 API，此处列出可能需要的最大集合]`
- V1 无可配置参数，`configSchema` 为空对象

## 10. 开放问题

1. **[BLOCKER] `message_sending` hook 是否支持 content 重写** — SDK 文档中 `message_sending` 的决策语义仅明确记录了 `{ cancel: true }` 终止发送，以及 `{ cancel: false }` 视为无决策。Format Guard 的整个架构依赖于返回 `{ content: fixedString }` 来重写消息内容。如果该 hook 不支持 content 重写，需要寻找替代方案（如 `before_agent_finalize` + 重写指令）。**必须在架构设计开始前验证。**
2. **冷却机制的精确实现方式** — 当前设计为混合方案：`message_sending` 记录发送事实到 session 状态，`enqueueNextTurnInjection` 或 `before_prompt_build` 注入抑制信号。需确认 `registerSessionExtension` 的具体使用方式，以及 session 状态在 Gateway 重启后是否持久化（如不持久化则可接受——重启后冷却窗口自然重置）。
3. **表情包资源部署路径** — 插件内置的 PNG 文件安装后放在哪里？是否需要 copy 到 `stickers/v2/` 目录？还是插件可以注册自己的资源路径？需要调研 OpenClaw 的插件资源管理机制。
4. **权限标志摩擦** — 冷却机制的 prompt 注入类 hook 需要 `allowConversationAccess` 和/或 `allowPromptInjection`。社区插件要求 operator 手动启用这些权限，可能影响安装体验。需确认最终所需的最小权限集合。
5. **表情包渲染依赖** — `MEDIA:` 指令的渲染由 WeCom channel 插件处理，claw-sticker 能否获知渲染是否成功？如果 channel 侧不支持，是否需要 fallback？
6. **多 session 冷却隔离** — 同一 Agent 可能同时在多个 WeCom 群聊中活动。冷却窗口是 per-session 还是 global？`[ASSUMPTION: per-session，各群聊独立计算]`

## 11. 假设索引

- §4.3 FR-10: 概率表述为"大约 30%-50% 的匹配场景下考虑发送"，实际表述待确认
- §4.3 FR-11: 冷却窗口为最近 5 条消息内最多 1 次表情，具体数值待确认
- §4.3 FR-11: 冷却采用混合方案：`message_sending` 记录状态 + `enqueueNextTurnInjection` 或 `before_prompt_build` 注入抑制信号，具体选择待架构确认
- §4.1 FR-1: 静态指南注入使用 `registerMemoryPromptSupplement` 等会话级 API（`agentPromptGuidance` 是 command 级属性，不适合 always-on 注入），具体选择待架构设计确认
- §9.3: 所需权限标志（`allowConversationAccess`、`allowPromptInjection`）取决于最终选定的 API，此处列出可能的最大集合
- §4.4 FR-13: 表情包部署到 `stickers/v2/` 目录，与现有路径约定一致
- §10 Q5: 冷却窗口 per-session 隔离
