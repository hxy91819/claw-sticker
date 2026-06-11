## 结论：V1 推荐方案 C，但做成“C 为主、B 作为可选逃生口、A 只保留极轻提示”

我建议 `claw-sticker` V1 采用：

> **插件侧自动决策 + Format Guard + 极轻 prompt guidance。**

也就是：模型正常回答；插件在 `message_sending` 出站阶段做两件事：先把已有的错误 sticker 表达修正成 WeCom 能识别的严格格式，再根据最终文本做低频、保守、可控的自动追加。

这个方向和 OpenClaw 的插件 seam 是匹配的。官方文档把 plugin hooks 定义为可以检查或修改 message flow 的进程内扩展点，并明确列出 `message_sending` 可用于改写出站内容或取消发送；typed hooks 也建议通过 `api.on(...)` 注册，且支持 priority 和 timeout 预算。([OpenClaw][1]) `message_sending`、`reply_payload_sending`、`before_dispatch` 都属于消息投递前后的可扩展点，后两者也可以作为未来兜底 seam。([OpenClaw][1])

一句话判断：

> **表情包不是模型任务的一部分，而是 channel rendering 的轻量情绪增强。V1 应该把它从模型 prompt 里拿出来，放到插件策略层处理。**

---

## 1. 三个方案评估

| 方案                                  | 适合度 | 判断                                                                                        |
| ----------------------------------- | --: | ----------------------------------------------------------------------------------------- |
| 方案 A：Prompt 控制 + Format Guard       |   低 | 可以快速验证，但不适合 V1 正式方案。它把“何时发表情”和“如何格式化”都塞给模型，容易让模型在主任务之外背格式规则。即使 Format Guard 能修格式，触发仍然不可控。 |
| 方案 B：模型输出 `[sticker:happy]` + 插件格式化 |   中 | 比 A 好，适合作为**显式控制通道**，但不适合作为默认触发机制。它降低了格式错误，但仍然依赖模型稳定输出 marker，而且 marker 泄漏到用户可见文本的风险必须处理。 |
| 方案 C：插件侧自动决策 + Format Guard         |   高 | 最适合 V1。模型只负责自然回答，插件负责 WeCom 格式、概率、冷却、禁用场景和最终校验。它牺牲了一部分深层语义理解，但换来产品体验的可控性。                 |

我的推荐不是纯 C，而是：

> **C as default，B as optional override，A only as minimal guidance。**

具体含义是：

模型默认不要输出 `MEDIA:`，也不需要主动想表情。插件根据最终回复自动追加。
如果未来需要手动控制，可以支持 `[sticker:happy]` 作为内部 marker，但不要把它作为 V1 的主要触发路径。
Prompt 只写一两句话，避免模型乱写 `MEDIA:` 或 Markdown 图片。

---

## 2. 方案 C 的核心原理

`claw-sticker` 不应该被设计成“智能表情 agent”，而应该是一个**发送层情绪增强中间件**。

它的核心原则是：

> **宁可少发，不要乱发；宁可朴素，不要聪明过头。**

插件只基于最终出站文本做浅层判断，不追求完全理解上下文。它判断的不是“用户真正情绪是什么”，而是“这条回复是否出现了足够明确、足够安全的轻量表情机会”。

因此 V1 的目标不是：

> “像人一样精确判断所有语境。”

而是：

> “在 5%–10% 的合适消息里，稳定、自然、格式正确地补一个表情。”

这比“每次成功都发 happy，每次报错都发 awkward”更像真实聊天。

---

## 3. 推荐模块边界

建议拆成 7 个小模块，不要把逻辑堆在一个 hook handler 里。

```text
message_sending(event)
  ↓
ChannelGate
  ↓
FormatGuard / Canonicalizer
  ↓
EligibilityGuard
  ↓
SignalClassifier
  ↓
DecisionPolicy
  ↓
WeComRenderer
  ↓
FinalValidator
  ↓
return { content }
```

### 3.1 ChannelGate

只在企业微信 WeCom 场景启用。其他 channel 默认 no-op。

建议配置：

```ts
{
  enabled: true,
  channels: ["wecom"],
  autoAppend: true,
  formatGuard: true
}
```

### 3.2 StickerRegistry

只允许白名单里的 7 个表情。

```ts
const STICKERS = {
  happy: "stickers/v2/happy.png",
  love: "stickers/v2/love.png",
  cool: "stickers/v2/cool.png",
  confused: "stickers/v2/confused.png",
  nervous: "stickers/v2/nervous.png",
  sigh: "stickers/v2/sigh.png",
  awkward: "stickers/v2/awkward.png"
} as const;
```

不要允许任意路径。即使模型输出了：

```text
MEDIA: /root/.openclaw/workspace/stickers/v2/happy.png
```

也只能提取 basename 并映射回：

```text
MEDIA: stickers/v2/happy.png
```

### 3.3 FormatGuard / Canonicalizer

负责把模型可能输出的错误格式统一修正。

要支持修正这些形式：

```text
📎 stickers/v2/happy.png
![](stickers/v2/happy.png)
搞定了 MEDIA: stickers/v2/happy.png
  MEDIA: stickers/v2/happy.png
MEDIA: /root/.openclaw/workspace/stickers/v2/happy.png
[sticker:happy]
```

统一成：

```text
搞定了
MEDIA: stickers/v2/happy.png
```

注意：Format Guard 应该忽略代码块、行内代码、日志示例里的 `MEDIA:`，否则用户问“正确格式是什么”时，你的插件可能把示例误变成真实表情。

### 3.4 EligibilityGuard

判断这条消息是否允许自动追加表情。

它应该在自动决策之前执行，但在 Format Guard 之后执行。

如果消息已经有合法 sticker，则不再自动追加第二个。
如果消息里有媒体、文件、长代码、严肃内容、用户明确要求不要表情，则直接禁止自动追加。

### 3.5 SignalClassifier

只做浅层信号分类，不做复杂语义推理。

输入：清理后的最终文本。
输出：候选 sticker、置信度、触发原因。

例如：

```ts
type StickerCandidate = {
  name: "happy" | "love" | "confused" | "nervous" | "sigh" | "awkward" | "cool";
  score: number;
  reason: string;
};
```

### 3.6 DecisionPolicy

负责概率、冷却、每日上限、同 sticker 间隔、用户/会话禁用。

这一步的职责是让表情“不机械”。

### 3.7 WeComRenderer + FinalValidator

Renderer 只做一件事：

```text
MEDIA: stickers/v2/<name>.png
```

FinalValidator 再扫一遍最终文本，确保没有前导空格、没有绝对路径、没有 inline `MEDIA:`、没有未知 sticker。

---

## 4. 规则匹配应该设计到什么程度？

V1 不要做复杂语义系统。建议采用：

> **强阻断规则 + 少量高精度关键词 + 分数阈值 + 概率控制。**

不要做大而全的 keyword zoo。规则越多，越容易误发，也越难维护。

### 4.1 推荐的 V1 分类规则

| 类别           |    自动触发建议 | 推荐表情                       | 说明                     |
| ------------ | --------: | -------------------------- | ---------------------- |
| 任务完成 / 好消息   |        启用 | `happy.png`                | 最适合自动化，文本特征明显。         |
| 感谢 / 喜欢 / 肯定 |      谨慎启用 | `love.png`                 | 只在语气轻松、非严肃场景使用。        |
| 困惑 / 不确定     |    启用但低概率 | `confused.png`             | 适合“这个现象有点奇怪”“我再确认下”。   |
| 轻微失败 / 翻车    |    启用但强阻断 | `awkward.png` / `sigh.png` | 只用于轻量技术失败，不用于事故、投诉、损失。 |
| 紧张 / 风险      |  默认低概率或关闭 | `nervous.png`              | 容易显得不专业，V1 不建议高频。      |
| 装酷 / 得瑟      | 默认关闭或极低概率 | `cool.png`                 | 只在明确玩笑、自嘲、得瑟语境中使用。     |

### 4.2 规则示例

#### happy

强信号：

```text
搞定了
完成了
已经处理好了
修好了
配置更新好了
构建通过了
测试通过了
部署成功了
可以正常用了
```

排除：

```text
还没完成
没有通过
修复失败
暂时无法完成
虽然完成了部分，但还有问题
```

#### love

强信号：

```text
谢谢
感谢
辛苦了
很棒
太好了
收到你的认可
```

但不要在这些场景触发：

```text
投诉
事故复盘
裁员
绩效
道歉
严重错误
用户生气
```

#### confused

强信号：

```text
有点奇怪
不太确定
需要再确认一下
我再核对一下
这个现象不太一致
这里看起来不符合预期
```

#### awkward / sigh

轻微失败信号：

```text
报错了
没通过
翻车了
出错了
卡住了
不太顺
这里失败了
```

区分建议：

| 语境           | 表情            |
| ------------ | ------------- |
| 自己的小失误、轻微翻车  | `awkward.png` |
| 外部阻塞、事情不顺、无奈 | `sigh.png`    |

但如果出现下面词汇，直接禁止：

```text
线上事故
数据丢失
安全漏洞
泄露
客户投诉
资损
故障升级
紧急
严重
报警
不可用
法律
合规
医疗
HR
绩效
裁员
```

#### nervous

只在“轻量风险提醒”里低概率出现：

```text
这个操作有点风险
先别急着执行
我有点担心这里会影响线上
最好先确认一下
```

V1 建议默认概率很低，甚至先不开。

#### cool

只在明显玩笑场景出现：

```text
这波稳了
拿捏
小秀一下
有点帅
这个解法还挺酷
```

并且不要在严肃技术报告、事故处理、用户求助焦虑场景出现。

---

## 5. 插件自动决策的误发风险，以及怎么降低

会有误发风险，主要有四类。

### 风险一：严肃场景误发表情

例如：

```text
线上事故已经恢复，但数据可能有丢失。
MEDIA: stickers/v2/happy.png
```

这是最危险的体验问题。

缓解方式：

使用强 blocker。只要命中严肃词，就禁止自动追加任何表情。

建议 blocker 覆盖：

```text
事故、故障、报警、宕机、数据丢失、泄露、资损、客户投诉、
合规、法律、医疗、隐私、安全漏洞、攻击、诈骗、裁员、绩效、投诉
```

### 风险二：技术长文后面跟表情显得廉价

例如长篇架构分析后跟一个 happy，会显得不专业。

缓解方式：

长度超过阈值不自动追加。比如：

```ts
maxAutoStickerTextLength = 500 或 800
```

如果内容包含：

````text
```code fence```
Markdown 表格
长列表
堆栈日志
diff
SQL
JSON 大段
````

默认不自动追加。

### 风险三：用户不喜欢表情

企业微信场景里，有些群非常工作化。

缓解方式：

提供配置和会话级禁用：

```ts
autoAppend.enabled = false
autoAppend.allowedRooms = [...]
autoAppend.deniedRooms = [...]
autoAppend.groupChatDefault = false
```

V1 可以先做配置级禁用，V1.1 再做用户指令：

```text
不要发表情
以后别发表情包
严肃点
```

命中后当前会话关闭一段时间，例如 24 小时或永久。

### 风险四：模型已经写了 sticker，插件又追加一个

缓解方式：

执行顺序中明确规定：

> **只要 Format Guard 检测到已有 sticker，无论原来格式对不对，修正后都不再自动追加。**

---

## 6. Format Guard 和自动追加的组合顺序

推荐顺序是：

```text
1. 进入 message_sending
2. 判断是否 WeCom channel，不是则 no-op
3. Format Guard：修正已有 sticker / marker / 错误路径
4. 如果已有合法 sticker：FinalValidator 后返回
5. EligibilityGuard：判断是否允许自动追加
6. SignalClassifier：根据最终文本选候选 sticker
7. DecisionPolicy：概率、冷却、每日上限
8. WeComRenderer：追加 MEDIA 行
9. FinalValidator：最终格式校验
10. return { content }
```

也就是：

> **先修正，再判断；已有 sticker 优先；最后再校验一次。**

原因是：

如果模型已经表达了明确 sticker 意图，插件应该尊重并格式化它，而不是再进行一次自动决策。

### 示例

输入：

```text
搞定了 MEDIA: stickers/v2/happy.png
```

输出：

```text
搞定了
MEDIA: stickers/v2/happy.png
```

不再额外追加。

输入：

```text
已完成，我把配置更新好了。
```

可能输出：

```text
已完成，我把配置更新好了。
MEDIA: stickers/v2/happy.png
```

输入：

```text
这里报错了，构建没有通过。
```

可能输出：

```text
这里报错了，构建没有通过。
MEDIA: stickers/v2/awkward.png
```

输入：

```text
线上事故已经恢复，但还有数据一致性风险。
```

输出：

```text
线上事故已经恢复，但还有数据一致性风险。
```

不发任何表情。

---

## 7. 冷却窗口和概率建议

V1 建议非常保守。目标不是“显得很活泼”，而是“偶尔自然”。

### 7.1 默认冷却

建议同时使用时间冷却和消息数冷却：

```ts
threadCooldownMinutes = 15
minAssistantMessagesBetweenStickers = 4
sameStickerCooldownMinutes = 45
dailyMaxPerThread = 6
```

解释：

一条会话里 15 分钟最多触发一次，且至少隔 4 条 assistant 消息。
同一个 sticker 45 分钟内不要重复。
每天每个 thread 最多 6 次，避免长群聊里过度出现。

### 7.2 默认概率

建议把真实出现率压低。

| 表情             |    默认自动概率 | 建议               |
| -------------- | --------: | ---------------- |
| `happy.png`    | 0.20–0.30 | 只在强完成信号下触发。      |
| `love.png`     | 0.10–0.18 | 感谢类轻触发。          |
| `confused.png` | 0.08–0.15 | 保守触发。            |
| `awkward.png`  | 0.08–0.15 | 只用于轻微翻车。         |
| `sigh.png`     | 0.08–0.15 | 只用于轻微无奈。         |
| `nervous.png`  | 0.03–0.08 | V1 可默认关闭。        |
| `cool.png`     | 0.02–0.05 | V1 建议默认关闭或只支持手动。 |

更合理的策略是：

```ts
finalProbability = baseProbability * confidenceMultiplier * contextMultiplier
```

例如：

```ts
happy strong signal: 0.25
happy weak signal: 0.10
cool strong signal: 0.05
cool weak signal: 0
```

不要让弱信号也参与随机，否则误发会明显变多。

---

## 8. 明确禁止自动追加的场景

V1 应该有一个强 deny list。以下场景建议完全禁止自动追加：

1. 非 WeCom channel。
2. 消息已经包含合法或可修正的 sticker。
3. 用户明确说不要表情、严肃点、别发表情包。
4. 群聊默认未启用，或 room 在 deny list。
5. 消息包含代码块、长日志、stack trace、diff、SQL、JSON 大段。
6. 消息长度超过 500–800 字。
7. 正在解释 `MEDIA:` 格式、插件格式、Markdown 示例。
8. 严重错误、线上事故、数据丢失、安全漏洞、隐私泄露、客户投诉。
9. 法律、医疗、财务、HR、绩效、裁员等严肃场景。
10. 用户明显生气、投诉 agent、质疑服务质量。
11. agent 正在道歉或承认严重错误。
12. 后台 heartbeat、定时任务、监控告警类消息。
13. 消息是纯转发、引用、总结日志，不是自然对话。
14. 消息包含其他附件、图片、媒体控制指令。
15. 当前会话在冷却窗口内。

尤其要注意：`awkward.png` 虽然适合“翻车”，但不适合“我刚才严重搞错了，抱歉”。企业场景里，agent 对自己的错误自动贴一个尴尬表情，可能会让用户觉得不认真。V1 建议对 apology 场景默认禁用自动表情。

---

## 9. Prompt guidance 要不要保留？

要保留，但必须很轻。

不建议再写一大段“什么时候发 happy、什么时候发 love、MEDIA 必须独占一行”。这会污染主 prompt，也会让模型继续分心。

推荐 prompt 只写：

```text
你不需要主动发送表情包，也不要输出 MEDIA:、Markdown 图片或 sticker 文件路径。
企业微信表情由 claw-sticker 插件在发送前自动处理。
正常自然回复即可。
```

如果你要保留 B 方案的 marker 作为显式 escape hatch，可以加一行，但我建议 V1 暂时不要默认打开：

```text
仅当用户明确要求发送某个表情时，可以使用 [sticker:happy] 这类 marker；除此之外不要主动使用。
```

我的建议是：

> **V1 prompt 不教 marker；插件可以被动兼容 marker。**

也就是说，插件能处理 `[sticker:happy]`，但 prompt 不鼓励模型使用它。这样既有兼容性，又不会把 B 变成主路径。

---

## 10. 最小可交付 MVP

### MVP 必须包含

#### 1. WeCom-only gating

只在企业微信通道启用。

```ts
if (event.channel !== "wecom") return;
```

#### 2. Sticker 白名单

只允许 7 个 sticker。

```text
happy
love
cool
confused
nervous
sigh
awkward
```

#### 3. Format Guard

必须修正：

```text
📎 stickers/v2/happy.png
![](stickers/v2/happy.png)
搞定了 MEDIA: stickers/v2/happy.png
  MEDIA: stickers/v2/happy.png
MEDIA: /root/.openclaw/workspace/stickers/v2/happy.png
[sticker:happy]
```

#### 4. FinalValidator

最终输出必须满足：

```text
MEDIA: stickers/v2/<name>.png
```

且：

```text
MEDIA: 在行首
MEDIA: 独占一行
无前导空格
无绝对路径
无 Markdown 图片
无 📎
路径为相对路径
name 在白名单内
```

#### 5. 保守自动追加

V1 自动触发只建议开启 4 类：

```text
happy
love
confused
sigh / awkward
```

`cool` 和 `nervous` 先放到 registry 里，但默认自动触发关闭。

#### 6. 冷却和概率

最小配置：

```ts
{
  autoAppend: {
    enabled: true,
    threadCooldownMinutes: 15,
    minAssistantMessagesBetweenStickers: 4,
    sameStickerCooldownMinutes: 45,
    dailyMaxPerThread: 6
  }
}
```

#### 7. Debug / dry-run 日志

不要记录完整用户隐私内容，只记录：

```json
{
  "threadIdHash": "...",
  "decision": "append" | "skip" | "format_only",
  "sticker": "happy",
  "reason": "task_completed",
  "blockedBy": null
}
```

#### 8. 测试用例

MVP 测试应该覆盖三类：

1. 格式修正测试。
2. 禁用场景测试。
3. 概率/冷却策略测试。

OpenClaw 文档也提示，插件已安装不等于运行中的 Gateway 一定加载了最新 runtime；排查时需要确认 runtime inspect、Gateway 状态和必要的 restart。([OpenClaw][2]) 另外，历史 issue 中也出现过 `message_sending` 在某些文本投递路径不触发的问题，虽然该 issue 已关闭，但 V1 最好把 WeCom 真实消息路径的 smoke test 作为发布门槛。([GitHub][3])

---

## 11. MVP 应该推迟的能力

这些不要放进 V1：

| 能力            | 推迟原因                 |
| ------------- | -------------------- |
| LLM 二次分类器     | 成本高、延迟高、行为更不可控。      |
| 上下文级情绪理解      | V1 只看最终文本即可。         |
| 多表情连续发送       | 容易刷屏，且 WeCom 格式风险更高。 |
| 用户个性化学习       | 数据和隐私复杂度上升。          |
| 自动生成新表情       | 完全不是 V1 目标。          |
| 多 channel 抽象  | 先把 WeCom 做稳，再抽象。     |
| 复杂规则 UI       | 配置文件足够。              |
| 过多 sticker 类别 | 7 个已经足够。             |
| 复杂 prompt 训练  | 违背 C 方案初衷。           |

---

## 12. 推荐 TypeScript 伪代码

```ts
api.on(
  "message_sending",
  async (event) => {
    try {
      const cfg = event.context.pluginConfig;

      if (!cfg.enabled) return;
      if (!isWeCom(event)) return;

      const original = String(event.content ?? "");
      if (!original.trim()) return;

      // 1. 先做格式修正
      const guardResult = canonicalizeStickerSyntax(original, {
        allowedStickers: STICKERS,
        ignoreCodeBlocks: true,
        maxStickers: 1
      });

      let content = guardResult.content;

      // 2. 如果已经有 sticker，只做格式修正，不再自动追加
      if (guardResult.hasSticker) {
        const finalContent = finalValidateOrFallback(content, original);
        if (finalContent !== original) {
          return { content: finalContent };
        }
        return;
      }

      // 3. 自动追加总开关
      if (!cfg.autoAppend?.enabled) {
        const finalContent = finalValidateOrFallback(content, original);
        return finalContent !== original ? { content: finalContent } : undefined;
      }

      // 4. 禁用场景
      const eligibility = checkEligibility(content, event, cfg);
      if (!eligibility.allowed) {
        const finalContent = finalValidateOrFallback(content, original);
        return finalContent !== original ? { content: finalContent } : undefined;
      }

      // 5. 浅层分类
      const candidate = classifyStickerCandidate(content, cfg.rules);
      if (!candidate) {
        const finalContent = finalValidateOrFallback(content, original);
        return finalContent !== original ? { content: finalContent } : undefined;
      }

      // 6. 概率 + 冷却 + 上限
      const decision = decideSticker(candidate, event, cfg.policy);
      if (!decision.append) {
        const finalContent = finalValidateOrFallback(content, original);
        return finalContent !== original ? { content: finalContent } : undefined;
      }

      // 7. 渲染 WeCom MEDIA 行
      content = appendWeComSticker(content, candidate.name);

      // 8. 最终校验
      const finalContent = finalValidateOrFallback(content, original);

      if (finalContent !== original) {
        return { content: finalContent };
      }

      return;
    } catch (err) {
      // fail-open：插件异常不影响消息发送
      return;
    }
  },
  {
    // 建议让安全、脱敏、合规类插件先跑，sticker 作为靠后的内容增强
    priority: -50,
    timeoutMs: 100
  }
);
```

这里的 priority 建议设低一点，让安全脱敏、消息审计、敏感内容拦截类插件先处理文本，`claw-sticker` 最后做轻量增强。OpenClaw typed hooks 按 priority 顺序执行，高 priority 先执行，同优先级按注册顺序执行。([OpenClaw][1])

---

## 13. 规则配置建议

可以把规则做成 JSON 配置，而不是写死在代码里。

```json
{
  "enabled": true,
  "channels": ["wecom"],
  "formatGuard": {
    "enabled": true,
    "maxStickers": 1,
    "stripUnknownStickerMarkers": true,
    "ignoreCodeBlocks": true
  },
  "autoAppend": {
    "enabled": true,
    "groupChatDefault": false,
    "maxTextLength": 800,
    "threadCooldownMinutes": 15,
    "minAssistantMessagesBetweenStickers": 4,
    "sameStickerCooldownMinutes": 45,
    "dailyMaxPerThread": 6
  },
  "probabilities": {
    "happy": 0.25,
    "love": 0.14,
    "confused": 0.12,
    "awkward": 0.12,
    "sigh": 0.12,
    "nervous": 0.05,
    "cool": 0.03
  },
  "autoEnabledStickers": [
    "happy",
    "love",
    "confused",
    "awkward",
    "sigh"
  ],
  "disabledAutoStickers": [
    "cool",
    "nervous"
  ]
}
```

V1 默认不要让 `cool` 自动触发。`cool` 是最容易显得油腻或不合时宜的表情。可以先只支持 marker 或后续配置开启。

---

## 14. 推荐的 Format Guard 规则

### 14.1 合法输出

只允许：

```text
MEDIA: stickers/v2/happy.png
MEDIA: stickers/v2/love.png
MEDIA: stickers/v2/cool.png
MEDIA: stickers/v2/confused.png
MEDIA: stickers/v2/nervous.png
MEDIA: stickers/v2/sigh.png
MEDIA: stickers/v2/awkward.png
```

### 14.2 错误格式修正表

| 输入                                                       | 输出                                  |
| -------------------------------------------------------- | ----------------------------------- |
| `📎 stickers/v2/happy.png`                               | `MEDIA: stickers/v2/happy.png`      |
| `![](stickers/v2/happy.png)`                             | `MEDIA: stickers/v2/happy.png`      |
| `[sticker:happy]`                                        | `MEDIA: stickers/v2/happy.png`      |
| `搞定了 MEDIA: stickers/v2/happy.png`                       | `搞定了\nMEDIA: stickers/v2/happy.png` |
| `  MEDIA: stickers/v2/happy.png`                         | `MEDIA: stickers/v2/happy.png`      |
| `MEDIA: /root/.openclaw/workspace/stickers/v2/happy.png` | `MEDIA: stickers/v2/happy.png`      |

### 14.3 未知 sticker

输入：

```text
[sticker:evil]
MEDIA: stickers/v2/evil.png
```

建议 V1 直接移除或降级为普通文本，不要发送媒体。

更稳的策略是：

```text
未知 marker：移除
未知 MEDIA 路径：不作为媒体发送
```

因为 `MEDIA:` 是 channel 控制协议，不是普通用户文本。宁可不发，也不要把错误路径交给 WeCom。

---

## 15. 最终架构建议

我会把 `claw-sticker` 设计成三层：

```text
Intent Layer
  - 从最终文本中识别轻量情绪机会
  - 不依赖模型主动输出
  - 不做深层上下文理解

Policy Layer
  - 禁用场景
  - 概率
  - 冷却
  - 每日上限
  - 会话/群配置

Rendering Layer
  - WeCom MEDIA 格式
  - 相对路径
  - 白名单
  - Format Guard
  - Final Validator
```

这三个层次的边界很重要。

不要让 Intent Layer 直接拼 `MEDIA:`。
不要让 Rendering Layer 判断“开心还是困惑”。
不要让 Prompt 承担 Rendering Layer 的职责。

这样以后如果支持 Slack、Telegram、飞书，也只需要换 Rendering Layer。

---

## 16. 逐步落地计划

### Phase 0：锁定协议和测试夹具

先写测试，不急着写自动决策。

测试内容包括：

```text
正确格式不变
错误格式修正
inline MEDIA 拆行
绝对路径转相对路径
Markdown 图片转 MEDIA
📎 转 MEDIA
marker 转 MEDIA
未知 sticker 被移除或忽略
代码块里的 MEDIA 不处理
已有 sticker 不追加第二个
```

目标是先把格式稳定性做到 100%。

### Phase 1：只发布 Format Guard

第一版可以先不开自动追加，只做格式修正。

这一步价值很高，因为它能立即解决最危险的问题：WeCom 格式错误。

配置：

```json
{
  "formatGuard": { "enabled": true },
  "autoAppend": { "enabled": false }
}
```

### Phase 2：自动追加 dry-run

开启规则判断，但不真实追加，只打日志：

```json
{
  "decision": "would_append",
  "sticker": "happy",
  "reason": "task_completed"
}
```

跑一段真实 WeCom 消息，观察误判率。

### Phase 3：小范围开启自动追加

只开启：

```text
happy
confused
awkward
sigh
love
```

并使用保守概率和冷却。

暂不开：

```text
cool
nervous
```

### Phase 4：加入用户控制

支持：

```text
不要发表情
以后别发表情包
可以发表情
```

对应 session-level 或 room-level 配置。

### Phase 5：抽象 channel renderer

当 WeCom 稳定后，再把架构抽象成：

```ts
interface StickerRenderer {
  canRender(channel: string): boolean;
  render(sticker: StickerName): string;
  validate(content: string): ValidationResult;
}
```

然后再考虑飞书、Slack、Telegram 等 channel。

---

## 17. 最终建议摘要

我建议 `claw-sticker` V1 这样定：

```text
默认方案：C
辅助能力：Format Guard + 可选 marker 兼容
Prompt：极轻，不教模型写 MEDIA
自动触发：高精度、低频、强冷却
禁用策略：比触发策略更重要
MVP 顺序：先格式稳定，再自动追加
```

最关键的产品判断是：

> **表情包的价值来自“偶尔自然”，不是“每次正确”。**

所以 V1 不要追求召回率，应该追求精确率、格式稳定和可关闭。
一个好的 `claw-sticker` 插件，应该让用户觉得“它偶尔挺有灵气”，而不是让用户意识到“这里有一套规则正在机械地给我贴图”。

[1]: https://docs.openclaw.ai/plugins/hooks "Plugin hooks - OpenClaw"
[2]: https://docs.openclaw.ai/tools/plugin "Plugins - OpenClaw"
[3]: https://github.com/openclaw/openclaw/issues/15389 "message_sending and message_sent plugin hooks never fire on common text delivery paths · Issue #15389 · openclaw/openclaw · GitHub"
