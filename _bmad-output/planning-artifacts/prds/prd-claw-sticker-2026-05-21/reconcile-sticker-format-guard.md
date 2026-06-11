# PRD Input Reconciliation: sticker-format-guard-plugin-prompt.md

**Source:** `docs/sticker-format-guard-plugin-prompt.md`
**PRD Draft:** `_bmad-output/planning-artifacts/prds/prd-claw-sticker-2026-05-21/prd.md`
**Reviewer:** PRD Input Reconciliation Agent
**Date:** 2026-05-21

---

## 1. Source Information Inventory

Each distinct piece of information in the source is listed below, with a coverage verdict.

### 1.1 Background / Problem Statement

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 1 | Agent names referenced: **Eliy / LightPilot** | PRD generalizes to "OpenClaw Agent" | ✅ OK — intentional abstraction |
| 2 | Agent sends stickers via `MEDIA: stickers/v2/<name>.png` | §3 Terminology, §4.2 | ✅ Covered |
| 3 | Five known format errors enumerated (📎, markdown, inline, leading space, absolute path) | §1 愿景, FR-4–FR-8 | ✅ Covered |

### 1.2 Goal

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 4 | Develop an **OpenClaw Plugin** to intercept and auto-correct before channel delivery | §4.2, §1 愿景 | ✅ Covered |

### 1.3 Hook Choice

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 5 | Use `message_sending` hook via `api.on("message_sending", ...)` | §4.2, §3 Terminology | ✅ Covered |
| 6 | Hook can rewrite `content` | Implied by §4.2 FR-4–FR-8 | ✅ Covered |
| 7 | Hook does not modify other normal text | FR-9 | ✅ Covered |

### 1.4 Correction Rules

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 8 | Rule 1: 📎 format → MEDIA: (line starts with 📎 AND contains `stickers/`) | FR-4 | ✅ Covered |
| 9 | Rule 2: Markdown `![](stickers/v2/xxx.png)` or `![text](stickers/v2/xxx.png)` → MEDIA: | FR-5 | ✅ Covered |
| 10 | Rule 3: Text + MEDIA on same line → split into two lines | FR-6 | ✅ Covered |
| 11 | Rule 4: Leading spaces before MEDIA: → strip | FR-7 | ✅ Covered |
| 12 | Rule 5: Absolute path → relative path, split on `stickers/` | FR-8 | ✅ Covered |
| 13 | Rules execute **in stated priority order** (1 → 2 → 3 → 4 → 5) | FR-9 mentions priority order FR-4→FR-8 | ✅ Covered |

### 1.5 Safety Constraints

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 14 | Only fix format, don't change other content | FR-9 | ✅ Covered |
| 15 | If no sticker-related content, pass through unchanged | FR-9 | ✅ Covered |
| 16 | **"支持 wecom / 企微 / 微信等多个 channel"** | PRD §5 explicitly says V1 is WeCom-only | ⚠️ **CONFLICT** — see Gap 1 |
| 17 | High priority: `priority: 100` | §4.2 | ✅ Covered |
| 18 | Rationale for priority 100: so downstream hooks see corrected content | §4.2 "确保下游 hook 看到的是修正后的内容" | ✅ Covered |

### 1.6 Code Implementation

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 19 | Full reference implementation in TypeScript | PRD §0 references source doc for technical details | ✅ Covered by reference |
| 20 | Plugin ID in code: `"sticker-format-guard"` | PRD §9.1 uses `"claw-sticker"` as plugin ID | ⚠️ **DISCREPANCY** — see Gap 2 |
| 21 | Plugin name: `"Sticker Format Guard"` | Not in PRD | ℹ️ Minor, implementation detail |
| 22 | Plugin description: `"Auto-correct sticker MEDIA: format before message delivery"` | Not in PRD | ℹ️ Minor |
| 23 | Import from `openclaw/plugin-sdk/plugin-entry` (`definePluginEntry`) | §8.3 references SDK API version | ✅ Covered |
| 24 | `fixStickerFormat()` returns original content if nothing was modified (`modified` flag) | FR-9 implies this behavior | ✅ Implicitly covered |
| 25 | Console logging on fix: `[StickerFormatGuard] Fixed sticker format` | Not in PRD | ⚠️ **GAP** — see Gap 3 |
| 26 | Hook returns `{ content: fixed }` to rewrite message | Implementation detail, not PRD scope | ✅ OK |
| 27 | Rule 2 regex matches optional `!` prefix: `/^!?\[.*?\]\((stickers\/.*\.png)\)$/` | FR-5 test cases cover both `![]()` and `![text]()` | ✅ Covered |
| 28 | Rule 3 regex captures text and MEDIA parts separately | FR-6 "文字部分保留完整" | ✅ Covered |

### 1.7 Test Cases

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 29 | TC1: Correct format passthrough `搞定。\n\nMEDIA: stickers/v2/happy.png` → unchanged | FR-9 | ✅ Covered |
| 30 | TC2: `📎 stickers/v2/happy.png` → corrected | FR-4 test result | ✅ Covered |
| 31 | TC3: `![](stickers/v2/happy.png)` → corrected | FR-5 test result | ✅ Covered |
| 32 | TC4: `搞定。 MEDIA: stickers/v2/happy.png` → split to two lines | FR-6 test result | ✅ Covered |
| 33 | TC5: `  MEDIA: stickers/v2/happy.png` → leading spaces removed | FR-7 test result | ✅ Covered |
| 34 | TC6: `MEDIA: /root/stickers/v2/happy.png` → relative path | FR-8 test result | ✅ Covered |
| 35 | TC7: `今天天气不错，没有任何表情` → unchanged (no sticker) | FR-9 | ✅ Covered |
| 36 | TC8: `📎 stickers/v2/celebrate.png` → corrected | FR-4 covers 📎 format | ⚠️ **PARTIAL** — see Gap 4 |
| 37 | **8 specific test cases in a tabular format** with exact input/output pairs | PRD has testable results per FR, but not a consolidated test matrix | ⚠️ **GAP** — see Gap 5 |

### 1.8 Deployment Instructions

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 38 | Step 1: Compile to **CommonJS or ESM** bundle | §9.2 says "ESM bundle" only | ⚠️ **GAP** — see Gap 6 |
| 39 | Step 2: Place in plugin scan directory `dist/extensions/sticker-format-guard/` | §9.3 uses CLI-based install; no mention of manual directory | ⚠️ **GAP** — see Gap 7 |
| 40 | Step 3: Register in `openclaw.json` → `plugins.entries`: `"sticker-format-guard": { "enabled": true }` | §9.3 uses different registration key `"claw-sticker"` and different config structure | ⚠️ **DISCREPANCY** — see Gap 2 |
| 41 | Step 4: Add to `plugins.allow` whitelist | **Not in PRD** | ⚠️ **GAP** — see Gap 7 |
| 42 | Step 5: Restart Gateway to load plugin | **Not in PRD** | ⚠️ **GAP** — see Gap 7 |

### 1.9 Hook Choice Rationale

| # | Source Information | PRD Coverage | Verdict |
|---|---|---|---|
| 43 | `message_sending` is optimal — content fully generated, before network transmission | §4.2 implies timing but doesn't state rationale explicitly | ⚠️ **GAP** — see Gap 8 |
| 44 | `before_message_write` rejected — lower-level write hook, may not affect channel sending | **Not in PRD** | ⚠️ **GAP** — see Gap 8 |
| 45 | `before_dispatch` rejected — too early, may miss final formatting | **Not in PRD** | ⚠️ **GAP** — see Gap 8 |

---

## 2. Gap Analysis

### Gap 1: Multi-Channel Intent Conflict (MEDIUM)

**Source says:** "支持 wecom / 企微 / 微信等多个 channel" (safety constraint #16)

**PRD says:** §5 "不做多 channel 适配 — V1 仅支持 WeCom" and §2.3 lists non-WeCom users as non-target.

**Assessment:** The source includes multi-channel support as a *current* safety constraint ("this code supports multiple channels"), while the PRD scopes V1 to WeCom-only. This needs resolution: either the source reflects a broader design intent that the PRD is intentionally narrowing for V1 (in which case the PRD should acknowledge this), or the source's claim needs to be re-evaluated. The format guard's string manipulation logic is indeed channel-agnostic, but the `MEDIA:` directive itself is WeCom-specific. The PRD's scoping seems correct, but it should add a note acknowledging that the format guard's implementation is inherently channel-agnostic even though V1 only targets WeCom's MEDIA protocol.

**Recommendation:** Add a brief note in §4.2 or §5 that the format guard's string-level corrections are channel-agnostic by implementation, but V1 scope and testing are WeCom-only.

---

### Gap 2: Plugin ID Discrepancy (HIGH)

**Source says:** Plugin registers as `id: "sticker-format-guard"` in code and in `openclaw.json`.

**PRD says:** §9.1 declares `id: "claw-sticker"`.

**Assessment:** These are two different identifiers. The source is a technical spec for just the format guard component; the PRD is for the full claw-sticker plugin (which also includes prompt guidance). There are two possible interpretations:
- (a) The entire plugin is `claw-sticker`, and the source's code is one *module* within it — in which case the source's `definePluginEntry` ID should also be `claw-sticker`, and the source code needs updating.
- (b) The format guard is a separate sub-plugin — in which case the PRD should mention this ID.

Either way, the PRD and source are currently inconsistent on the canonical plugin ID. The deployment config in source (§1.8 #40) also uses `"sticker-format-guard"` as the key in `plugins.entries`, conflicting with the PRD's `"claw-sticker"`.

**Recommendation:** Clarify whether the final plugin ID is `claw-sticker` or `sticker-format-guard`. Update both documents to use a single canonical ID. If `claw-sticker` is the umbrella plugin and the format guard is a module within it, the source's `definePluginEntry({ id: ... })` should use `claw-sticker`.

---

### Gap 3: Observability / Logging Requirements (LOW-MEDIUM)

**Source says:** `console.log("[StickerFormatGuard] Fixed sticker format")` on every correction.

**PRD says:** Nothing about logging, metrics, or observability for format corrections.

**Assessment:** Logging is valuable for operators to verify the plugin is working and to debug format issues. The source's implementation includes a specific log line with a tag prefix. While individual log lines are implementation details, the *requirement* for observability — "operator can see in logs when format corrections occur" — is a product-level concern that the PRD should capture.

**Recommendation:** Add an NFR or note under §8 (or §4.2 FR-9) stating that format corrections should be logged at INFO level with a consistent tag for operator visibility.

---

### Gap 4: Format Guard Scope Beyond Built-in Stickers (MEDIUM)

**Source says:** Test case 8 uses `celebrate.png`, which is NOT in the 7 built-in stickers defined in PRD FR-12 (`happy`, `love`, `cool`, `confused`, `nervous`, `sigh`, `awkward`).

**PRD says:** FR-12 lists exactly 7 built-in stickers. FR-4–FR-8 test cases only use `happy.png`.

**Assessment:** The source implicitly demonstrates that the format guard should work on *any* sticker filename matching the `stickers/v2/*.png` pattern, not just the 7 built-in names. This is important because:
- Operators might add custom stickers in future versions
- The code's regex doesn't filter by name — it matches any `stickers/*.png`
- The PRD doesn't explicitly state whether the guard is limited to the 7 built-in names or works generically

**Recommendation:** Add a clarifying note to FR-9 or §4.2 description: "Format Guard corrects any path matching `stickers/**/*.png`, not limited to the 7 built-in sticker names. This ensures forward compatibility with future sticker additions."

---

### Gap 5: Consolidated Test Matrix Not in PRD (LOW)

**Source says:** Provides a complete 8-row test case table with exact input/output pairs in a single view.

**PRD says:** Has individual "可测试结果" sections per FR, covering the same scenarios but distributed across multiple sections.

**Assessment:** The PRD's per-FR testable results are functionally equivalent and arguably better organized for a requirements document. However, the source's consolidated matrix is a useful QA artifact. The gap is minor — it's a presentation preference, not missing information.

**Recommendation:** No PRD change needed. The consolidated test matrix can live in a QA/test plan document or in the source spec itself.

---

### Gap 6: CommonJS Build Target (LOW)

**Source says:** Step 1: "插件代码编译为 CommonJS 或 ESM bundle"

**PRD says:** §9.2: "源码 TypeScript，构建为 ESM bundle"

**Assessment:** The source allows CommonJS as a build target; the PRD specifies ESM only. If OpenClaw's plugin runtime supports both module formats, this is a gap. If the project has standardized on ESM, the source is outdated.

**Recommendation:** Confirm with architecture whether CommonJS is a supported target. If yes, update §9.2 to say "ESM bundle（推荐）或 CommonJS". If no, note that the source's CommonJS mention is outdated.

---

### Gap 7: Manual Deployment Path and `plugins.allow` (MEDIUM)

**Source says:** Five-step manual deployment: compile → copy to `dist/extensions/` → edit `openclaw.json` entries → add to `plugins.allow` → restart Gateway.

**PRD says:** §9.3 describes CLI-based install `openclaw plugins install clawhub:openclaw/claw-sticker` and Gateway config JSON.

**Assessment:** Two distinct deployment models are described:
- **Source:** Manual file placement + `openclaw.json` config editing (developer/debugging flow)
- **PRD:** CLI-based package install from clawhub (production user flow)

The PRD's model is the intended production flow, so this is likely an intentional evolution. However, several source details are missing from the PRD:

1. **`plugins.allow` whitelist** — Source step 4 mentions a separate `plugins.allow` array. PRD doesn't mention this. If the allow-list is a real OpenClaw security gate, operators need to know.
2. **Gateway restart requirement** — Source step 5 says restart is needed. PRD doesn't say whether install takes effect immediately or requires restart.
3. **Manual/dev deployment path** — For plugin developers (a target persona per §0), the manual deployment flow from the source is still relevant. PRD doesn't provide a dev-mode setup path.

**Recommendation:**
- Confirm whether `plugins.allow` is still required with CLI-based install (it may be handled automatically).
- Add a note to §9.3 about whether Gateway restart is required after install.
- Consider adding a "Developer Setup" section or referencing the source doc for manual deployment.

---

### Gap 8: Hook Choice Rationale (MEDIUM)

**Source says:** Dedicated section "为什么不用 `before_message_write` 或其他钩子" explaining:
- `message_sending` is optimal: content fully generated, before network
- `before_message_write` rejected: lower-level, may not affect channel
- `before_dispatch` rejected: too early, may miss final formatting

**PRD says:** §4.2 uses `message_sending` but doesn't explain why alternatives were rejected.

**Assessment:** This rationale is an architectural decision that affects maintainability. Future contributors may question or attempt to change the hook choice without understanding why alternatives were rejected. PRDs commonly omit this level of detail, but given that the PRD explicitly references the source doc and this is a single-function plugin, the decision rationale adds significant value.

**Recommendation:** Either:
- Add this as a decision record in the PRD's decision log (`.decision-log.md`), or
- Add a brief note in §4.2 description: "选择 `message_sending` 而非 `before_message_write`（太底层，可能不影响 channel 发送）或 `before_dispatch`（太早，可能错过最终格式化）"

---

## 3. Summary

| Severity | Count | Gaps |
|----------|-------|------|
| HIGH | 1 | Gap 2 (Plugin ID discrepancy) |
| MEDIUM | 4 | Gap 1 (multi-channel conflict), Gap 4 (guard scope), Gap 7 (deployment/allow), Gap 8 (hook rationale) |
| LOW-MEDIUM | 1 | Gap 3 (logging/observability) |
| LOW | 2 | Gap 5 (test matrix), Gap 6 (CommonJS) |

**Overall assessment:** The PRD captures the vast majority of the source's functional requirements accurately (FR-4 through FR-9 map well to Rules 1–5 and safety constraints). The most actionable gap is the **Plugin ID discrepancy** (Gap 2), which will cause real confusion during implementation if not resolved. The **deployment model differences** (Gap 7) and **hook choice rationale** (Gap 8) are valuable context that should be captured somewhere in the project documentation, even if not in the PRD body itself. The **format guard scope** (Gap 4) is a subtle but important clarification that prevents future ambiguity.
