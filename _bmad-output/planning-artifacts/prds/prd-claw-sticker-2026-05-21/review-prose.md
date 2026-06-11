# Prose Review: prd.md

**Reviewer:** Clinical copy-edit pass  
**Baseline:** Microsoft Writing Style Guide, adapted for Chinese technical writing  
**Scope:** Prose only (code blocks, frontmatter, structural markup excluded)

## Voice Notes (preserve)

- Conversational directness with intentional colloquialisms ("翻车", "得瑟", "五花八门")
- Em-dash parenthetical explanations (——) used consistently for aside context
- Chinese-body + English-term inline pattern is natural and well-established throughout

---

## Issues

| # | Original | Revised | Changes |
|---|----------|---------|---------|
| 1 | §1 "**引导层**在 Agent 思考时注入表情包使用指南和场景映射" | "**引导层**在会话建立时注入表情包使用指南和场景映射" | "Agent 思考时" 与 FR-1 定义的 "会话新建时一次性注入" 矛盾；改为与 FR-1 一致的时机描述，消除歧义 |
| 2 | §1 "引导层" vs §4.1 "这是**预防层**" | 统一使用 "**引导层**（预防层）" 或选定一个名称 | 同一概念（Prompt Guidance）在 §1 叫"引导层"、§4.1 叫"预防层"，术语不一致导致读者误以为是两个组件 |
| 3 | §1 "并以一定随机性决定是否发送，避免机械感" | "并以概率性方式决定是否发送，避免机械感" | "一定随机性" 是模糊限定；"概率性方式" 更精确，且与 FR-10 的描述对齐 |
| 4 | §1 "V1 聚焦企业微信（WeCom）通道，内置 7 个预设表情包，全部参数 hardcode。" | "V1 聚焦企业微信（WeCom）通道，内置 7 个预设表情包，所有参数均为硬编码。" | "hardcode" 作中文谓语/定语不合语法；改为"硬编码"（中文语境标准译法） |
| 5 | §4.1 FR-1 "后续 turn 不重复注入" | "后续对话轮次不重复注入" | "turn" 未收入术语表且未加反引号，非自明术语；使用中文"对话轮次"或在术语表中补充定义 |
| 6 | §4.1 FR-2 "当对话语境不强烈匹配任何特定场景时" | "当对话语境未明确匹配任何特定场景时" | "不强烈匹配" 是双重否定式表述，语义模糊；"未明确匹配" 更直接 |
| 7 | §4.1 FR-2 "`cool` 表情只在"装酷/得瑟"场景出现于候选池中" | "`cool` 表情仅在"装酷/得瑟"场景的候选池中出现" | 语序不自然（"在X场景出现于Y中"）；调整为"在X的Y中出现" |
| 8 | §4.2 描述 "也修正任何符合 `stickers/` 路径模式的 MEDIA 指令（包括未来新增的表情或用户自定义的表情包名称）" | "也修正任何符合 `stickers/` 路径模式的 MEDIA 指令（包括未来新增的表情文件名）" | "用户自定义的表情包名称" 与 §5 非目标"不做用户自定义表情包"措辞冲突；此处实际意指路径模式通配，改为"文件名"消除歧义 |
| 9 | §7 SM-C2 "不应为了提高指令遵从度而无限扩展 system context 注入量" | "不应为了提高指令遵从度而过度扩展 system context 注入量" | "无限扩展" 是夸张表述，在指标定义中不够严谨；"过度扩展" 更适合约束描述 |
| 10 | §8.4 "冷却机制的 prompt 注入类 hook 需要 operator 在插件配置中启用" | "冷却机制使用的 prompt 注入 hook 需要 operator 在插件配置中启用" | "prompt 注入类 hook" 是自造复合词，"类"字多余；"使用的 prompt 注入 hook" 更清晰 |
| 11 | §4.3 描述 "通过静态指南和动态状态两层配合" | "通过静态指南与动态状态的协同" | "两层配合" 与前文"引导层/兜底层"的双层概念混淆（这里是同一层内部的两种机制）；"协同" 避免与层级概念冲突 |
| 12 | §4.3 FR-11 "冷却仅影响 prompt 引导层的建议频率" | "冷却仅影响 Prompt 引导层的表情发送引导" | "建议频率" 暗示引导层是建议系统；实际是压制 prompt 注入信号，"表情发送引导" 更准确 |

---

**Total issues: 12**
