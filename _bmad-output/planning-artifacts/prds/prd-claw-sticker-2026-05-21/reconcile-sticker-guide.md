# PRD Input Reconciliation: sticker-comprehensive-guide.md

**Source:** `docs/sticker-comprehensive-guide.md`
**PRD Draft:** `_bmad-output/planning-artifacts/prds/prd-claw-sticker-2026-05-21/prd.md`
**Date:** 2026-05-21

---

## Methodology

Every distinct piece of information in the source guide was enumerated and checked for presence in the PRD — either directly stated, captured by reference, or logically subsumed by a broader requirement.

---

## Item-by-Item Reconciliation

### Section 一：当前可用表情包

| # | Source Item | PRD Coverage | Status |
|---|-----------|-------------|--------|
| 1 | Sticker storage base path: `/root/.openclaw/workspace/stickers/v2/` | PRD uses relative path `stickers/v2/` throughout; full absolute base path not recorded. FR-13 `[ASSUMPTION]` references `stickers/v2/` directory. | ✅ Sufficient |
| 2 | 7 stickers listed by filename | FR-12 lists all 7 filenames identically. | ✅ Covered |
| 3 | Emotion label per sticker (开心, 喜欢/感谢, 装酷/得瑟, 困惑, 紧张/焦虑, 叹气/无奈, 尴尬) | FR-2 scene-mapping implicitly encodes emotions. FR-1 mentions "情绪标签" as part of injected guide. | ✅ Covered |
| 4 | Use-case description per sticker (e.g. "任务完成、好消息、被夸") | FR-2 mapping table captures the same scenarios. | ✅ Covered |
| 5 | Individual file sizes (24–31 KB range) | **Not mentioned in PRD.** | ⚠️ Minor gap |
| 6 | `cool.png` restricted to "装酷/得瑟" only ("仅限此场景") | FR-2 explicitly states "`cool` 表情只在'装酷/得瑟'场景出现于候选池中". | ✅ Covered |

### Section 二：使用规则

| # | Source Item | PRD Coverage | Status |
|---|-----------|-------------|--------|
| 7 | `MEDIA:` is a WeCom-channel-specific instruction | §3 Terminology, §5 Non-goals, and multiple FR descriptions. | ✅ Covered |
| 8 | Iron rule 1: MEDIA: must be on its own line, at line start, no leading spaces/text/emoji | FR-6 (same-line split), FR-7 (leading spaces). §3 Terminology defines the format. | ✅ Covered |
| 9 | Iron rule 2: Text and MEDIA on separate lines | FR-6 covers this. | ✅ Covered |
| 10 | Iron rule 3: Use relative path `stickers/v2/<name>.png` | FR-8 (absolute→relative conversion). §3 Terminology. | ✅ Covered |
| 11 | Iron rule 4: Forbidden formats — `📎`, `![]()`, `![name](path)` | FR-4 (📎), FR-5 (Markdown image syntax). | ✅ Covered |
| 12 | Self-check mnemonic/flowchart ("有表情？→ 没有 → 过 → 有 → MEDIA: 单独一行？…") | **Not captured in PRD.** The PRD captures the underlying rules but not the self-check mental model / decision flowchart that the LLM is meant to internalize. | ⚠️ Minor gap |
| 13 | "适时使用，不要每条消息都发" | FR-3, FR-10. | ✅ Covered |
| 14 | "配合文字，不单独发" | FR-3 explicitly states this. | ✅ Covered |
| 15 | "认真干活时不发，确认完成后可以带上" | FR-3 explicitly states this. | ✅ Covered |
| 16 | **"默认从 happy, love 里随机选，不要用 cool"** — default candidate pool rule | **Not in PRD.** FR-2 restricts `cool` to 装酷/得瑟, which partially covers the "don't use cool" part. But the explicit instruction to **default to happy/love** when no specific scene matches is absent. This is a distinct behavioral rule: when the Agent wants to send a sticker but the scene doesn't strongly map, it should default to the happy/love pool. | 🔴 **GAP** |
| 17 | **LLM "Lost in the Middle" bias** — explicit reasoning for why sticker should be at end of reply | PRD FR-3 says "指南要求表情包置于回复末尾" (the rule is captured), but the **reasoning** — that LLM attention degrades in the middle of output and placing MEDIA at the end improves compliance — is not recorded. This reasoning matters because it explains *why* the rule exists and could inform future design decisions (e.g., if a model with different attention patterns is used). | ⚠️ Minor gap |

### Section 三：已被删除的表情（历史记录）

| # | Source Item | PRD Coverage | Status |
|---|-----------|-------------|--------|
| 18 | **10 deleted stickers listed by name** (celebrate, smug, salute, exhausted, sleepy, shocked, facepalm, eyeroll, pray, cool-girl) | **Not in PRD.** | 🔴 **GAP** |
| 19 | **Deletion reasons per sticker** — bottom watermarks, text overlay ("exhausted" text), cropping, low resolution, duplication (cool-girl = cool) | **Not in PRD.** These reasons directly imply quality acceptance criteria for sticker assets: no watermarks, no text overlay, sufficient resolution, no duplicates. The PRD's FR-12 only says "合格的 PNG 图片，可在 WeCom 中正常渲染" — this is a rendering requirement, not a visual quality requirement. | 🔴 **GAP** |
| 20 | General deletion rationale: "底部带文字水印、被裁剪、分辨率不足" | Same as #19 — not captured as quality criteria. | 🔴 (same as #19) |
| 21 | Planned new stickers: `angry.png` (生气/着急), `cute.png` (卖萌/撒娇) | §6.2 mentions "更多表情包：angry.png、cute.png 等计划新增的表情（待素材就绪后追加）[NON-GOAL for MVP]". | ✅ Covered |

### Section 四：自动化检查

| # | Source Item | PRD Coverage | Status |
|---|-----------|-------------|--------|
| 22 | **Existing validation script**: `/root/.openclaw/workspace/scripts/validate-media-format.py` | **Not in PRD.** This script already implements format validation logic. It is directly relevant as a reference implementation or test oracle for the Format Guard (FR-4–FR-8). The PRD makes no mention of it. | 🔴 **GAP** |
| 23 | Script interface: stdin pipe, exit code 0/1 | **Not in PRD.** | 🔴 (same as #22) |
| 24 | **Existing plugin attempt** at `/projects/.openclaw/extensions/sticker-format-guard/` | **Not in PRD.** The PRD references `docs/sticker-format-guard-plugin-prompt.md` in §0 but doesn't extract the key finding from that attempt. | 🔴 **GAP** |
| 25 | **Plugin loading constraint**: OpenClaw plugin scan path only includes built-in `dist/extensions/`; custom plugin directories are not scanned; plugins need pre-compiled JS bundles | **Not explicitly in PRD.** The PRD §9.2 says "构建为 ESM bundle" and §8.3 says "遵循 OpenClaw Plugin SDK 当前 API 版本", which implicitly address the "needs JS bundle" issue. But the **specific discovery that custom directories aren't scanned** (the reason the prior attempt failed) is not recorded. This is a critical technical constraint learned from experience. | 🔴 **GAP** |
| 26 | Plugin mechanism: `message_sending` hook for pre-send interception | §4.2 describes this. | ✅ Covered |

### Section 五：常见错误 vs 正确写法

| # | Source Item | PRD Coverage | Status |
|---|-----------|-------------|--------|
| 27 | 📎 format error and correction | FR-4. | ✅ Covered |
| 28 | Markdown image syntax error and correction | FR-5. | ✅ Covered |
| 29 | Text + MEDIA on same line error and correction | FR-6. | ✅ Covered |
| 30 | Leading spaces error and correction | FR-7. | ✅ Covered |
| 31 | Absolute path error and correction | FR-8. | ✅ Covered |

### Section 六：文档引用

| # | Source Item | PRD Coverage | Status |
|---|-----------|-------------|--------|
| 32 | **SOUL.md** — personality file (loaded at startup), contains sticker format rules and scene pool | **Not in PRD.** | 🔴 **GAP** |
| 33 | **AGENTS.md** — work rules (loaded at startup), contains validation script reference and error comparison table | **Not in PRD.** | 🔴 (same cluster) |
| 34 | **MEMORY.md** — long-term memory (main session loaded), contains daily report sticker selection rules | **Not in PRD.** | 🔴 (same cluster) |
| 35 | **config/daily-report-template.md** — daily report template, contains sticker selection mapping | **Not in PRD.** | 🔴 (same cluster) |
| 36 | **stickers/README.md** — sticker library docs, contains available sticker list | **Not in PRD.** | 🔴 (same cluster) |

**Why this cluster matters:** These 5 documents are the existing touchpoints where sticker rules are currently embedded *without* the plugin. The plugin needs to understand: (a) does it replace these rules or supplement them? (b) will there be conflicts between the plugin's injected guidance and these existing documents? (c) should the plugin's prompt guidance reference or defer to these documents? This is a significant architectural question not raised in the PRD's open questions (§10).

### Section 七：技术备注

| # | Source Item | PRD Coverage | Status |
|---|-----------|-------------|--------|
| 37 | `MEDIA:` is WeCom-specific; other channels use `message` tool's `filePath` parameter | §5 Non-goals: "Telegram/Discord 等 channel 使用不同的媒体发送机制（filePath 参数）". | ✅ Covered |
| 38 | Stickers currently only used in WeCom (企业微信群聊) | Covered throughout (§1 Vision, §2.3 Non-target users, §5 Non-goals). | ✅ Covered |
| 39 | **Avatar file** at `docs/lightpilot-avatar.png` (1920KB), character inconsistent with sticker set, needs remake | **Not in PRD.** Tangential to the plugin scope, but relevant to overall sticker visual consistency. | ⚠️ Minor gap (out of scope) |

---

## Gap Summary

### 🔴 Major Gaps (5)

**Gap 1: Default sticker pool rule — "默认从 happy, love 里随机选"**
- **Source:** §2.3 — When no specific scene strongly matches, Agent should default to picking from {happy, love}, explicitly avoiding cool.
- **PRD status:** FR-2 restricts `cool` to 装酷/得瑟 scene, but the **positive default** ("when in doubt, pick happy or love") is not stated. This is a distinct behavioral requirement that affects the prompt guidance content.
- **Impact:** Without this, the injected prompt guide may omit a key instruction, leading to the Agent choosing confused/nervous/sigh when a neutral positive response would be more appropriate.
- **Recommendation:** Add to FR-2 or FR-3 as a "default candidate pool" requirement.

**Gap 2: Deleted stickers history and sticker quality criteria**
- **Source:** §3 — 10 deleted stickers with specific reasons (watermarks, text overlay, cropping, low resolution, duplication).
- **PRD status:** FR-12 acceptance criteria only requires "合格的 PNG 图片，可在 WeCom 中正常渲染". No visual quality criteria.
- **Impact:** Without explicit quality acceptance criteria derived from past failures, future sticker additions (angry, cute, or V2 user-uploaded stickers) may repeat the same issues.
- **Recommendation:** Add sticker quality acceptance criteria to FR-12: no text watermarks, no cropping artifacts, minimum resolution threshold, no duplicate assets. Optionally document the deleted sticker history as context in §6.2 or an appendix.

**Gap 3: Existing validation script not referenced**
- **Source:** §4.1 — `validate-media-format.py` at a known path, with a defined interface (stdin/exit code).
- **PRD status:** Not mentioned anywhere.
- **Impact:** The script is a ready-made reference implementation and test oracle for FR-4–FR-8. Ignoring it means the development team may re-derive the same regex patterns from scratch and miss edge cases the script already handles.
- **Recommendation:** Reference the script in §4.2 Notes or §10 as a known prior art / test resource.

**Gap 4: Existing document touchpoints (SOUL.md, AGENTS.md, MEMORY.md, daily-report-template, stickers/README.md)**
- **Source:** §6 — 5 documents currently contain sticker rules, loaded at various lifecycle points.
- **PRD status:** Not mentioned. No discussion of overlap or migration.
- **Impact:** This is an integration risk. When the plugin injects its own prompt guidance, it may **conflict with or duplicate** sticker rules already present in SOUL.md and AGENTS.md. The PRD doesn't address whether the plugin should replace, supplement, or be aware of these existing rules. This should be an open question at minimum.
- **Recommendation:** Add an open question (§10): "How does the plugin's prompt guidance interact with existing sticker rules in SOUL.md, AGENTS.md, MEMORY.md, and config/daily-report-template.md? Should the plugin assume these are removed, or should it be designed to coexist?"

**Gap 5: Prior plugin attempt failure — custom directory not scanned**
- **Source:** §4.2 — The previous plugin attempt at `/projects/.openclaw/extensions/sticker-format-guard/` failed because OpenClaw only scans `dist/extensions/` for plugins; custom plugin directories are not scanned.
- **PRD status:** §9 covers packaging/distribution via clawhub, which implicitly avoids this problem. But the specific **learned constraint** is not recorded.
- **Impact:** Without recording this, the team may explore alternative distribution paths during development and hit the same wall. It also validates the PRD's decision to use clawhub as the distribution mechanism.
- **Recommendation:** Add as a note in §9 or §10: "Prior attempts to load the plugin from a custom directory failed because OpenClaw's plugin scanner only includes `dist/extensions/`. The clawhub distribution path avoids this constraint."

### ⚠️ Minor Gaps (4)

| # | Item | Note |
|---|------|------|
| M1 | Individual sticker file sizes (24–31 KB) | Could inform a max file size constraint for future stickers, but not critical for V1. |
| M2 | Self-check mnemonic/flowchart | The PRD captures the underlying rules but not the specific decision-tree format. If the prompt guidance literally includes this flowchart (as the source implies it should), the PRD should note it as part of the injected content specification. |
| M3 | LLM "Lost in the Middle" bias reasoning | The placement rule is captured; the reasoning could be added as a Note under FR-3 for posterity. |
| M4 | Avatar inconsistency (`docs/lightpilot-avatar.png`) | Out of plugin scope, but relevant to overall character consistency. Could be noted in §6.2 future considerations. |

---

## Reconciliation Statistics

- **Total distinct items in source:** 39
- **Fully covered in PRD:** 24 (62%)
- **Major gaps:** 5 (13%)
- **Minor gaps:** 4 (10%)
- **Items covered by same gap cluster:** 6 (15%)

---

## Recommended PRD Actions

1. **FR-2 or FR-3** — Add default candidate pool rule: "当无特定场景强匹配时，默认从 {happy, love} 中选择"
2. **FR-12** — Add sticker quality acceptance criteria: no watermarks, no text overlay, no cropping, minimum resolution, no duplicates. Add deleted sticker history as context.
3. **§4.2 Notes or §10** — Reference `validate-media-format.py` as existing prior art and potential test oracle.
4. **§10 (new open question)** — Address interaction between plugin prompt guidance and existing sticker rules in SOUL.md / AGENTS.md / MEMORY.md / daily-report-template / stickers/README.md.
5. **§9 or §10 (new note)** — Record the prior plugin loading failure and the constraint that led to the clawhub distribution decision.
