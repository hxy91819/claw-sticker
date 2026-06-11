# PRD Quality Review: Claw Sticker

**PRD:** `prd.md` (Claw Sticker V1, 2026-05-21)
**Context:** Launch-tier community plugin for OpenClaw; developer product
**Reviewer:** Rubric-based quality review
**Date:** 2026-05-21

---

## Overall Verdict

**Adequate with Strong sections — ready for architecture kickoff, not yet ready for story creation.**

The PRD has a clear two-layer thesis (prompt guidance + format guard), and the Format Guard section (FR-4–FR-9) is exemplary: concrete input→output specs an engineer could implement and test in a day. The document is well-proportioned for a community plugin (~300 lines, no bloat). However, ~40% of the functional requirements (Prompt Guidance, Cooldown) carry heavy `[ASSUMPTION]` loads that block implementation until architecture resolves them. More critically, the PRD does not surface two risks that could invalidate core design choices: (1) whether `message_sending` supports content rewriting at all (not just cancel), and (2) how the plugin's injected guidance coexists with sticker rules already embedded in SOUL.md, AGENTS.md, and MEMORY.md. One more pass to close these gaps before story creation.

---

## Dimension 1: Decision-readiness

**Judgment: Adequate**

### Strengths
- Decision log (D-001–D-010) covers all major V1 scope calls with rationale.
- Non-goals (§5) are specific and reasoned — each explains *why* it's excluded and names the alternative mechanism.
- Counter-metrics (SM-C1, SM-C2) show awareness of optimization dysfunctions.
- Open questions (§10) are substantive — Q1 and Q3 surface real architectural ambiguity.

### Weaknesses

- **[CRITICAL] SDK content-rewrite gap not surfaced.** The entire Format Guard architecture assumes `message_sending` handlers can rewrite message content. The SDK overview only documents `cancel` semantics for this hook. The PRD treats content rewriting as a given (§4.2 description, FR-4–FR-9) but never flags the risk that this capability may not exist or may work differently than assumed. This should be §10 Q6 — if the answer is "no," the Format Guard needs a fundamentally different hook.

- **[HIGH] Integration with existing sticker-rule documents not raised.** Five documents (SOUL.md, AGENTS.md, MEMORY.md, config/daily-report-template.md, stickers/README.md) already contain sticker format rules loaded at various Agent lifecycle points. The plugin's prompt guidance injection may duplicate or conflict with these. The PRD never asks: "Does the plugin replace these rules, supplement them, or need to be aware of them?" This is a decision a decision-maker needs to make before architecture.

- **Open questions don't distinguish blockers from nice-to-haves.** Q1 (cooldown mechanism) and Q2 (resource deployment path) are architectural blockers. Q4 (render feedback) and Q5 (multi-session isolation) are deferrable. Collapsing them into a flat list obscures priority.

---

## Dimension 2: Substance over theater

**Judgment: Strong**

### Strengths
- §2.1 persona is one focused paragraph — no "meet Sarah" theater.
- JTBD (§2.2) has 4 bullets, each grounded in the real problem. The "情感性" and "情境性" entries earn their place because naturalness and IM context are the product's core value proposition.
- User journeys (UJ-1, UJ-2) are concrete interaction scenarios, not abstract swim lanes.
- NFRs (§8) are plugin-specific: 5ms latency for string ops, fail-open resilience, `api.logger` for observability. No boilerplate "99.9% uptime" or "GDPR compliance."

### Weaknesses

- **[MEDIUM] SM-4 is vibes theater.** "安装者在连续使用一周后，不认为Agent发表情的频率'机械'或'烦人'" is not falsifiable. There's no instrument to measure this, no threshold, no collection method. This is a real concern (naturalness matters), but dressing it as a "success metric" implies measurability that doesn't exist. Honest framing: move to a "design principle" section or rewrite as a proxy metric (e.g., "sticker-to-message ratio stays between 10%–30% across a 50-message sample").

- **[LOW] SM-C2 is speculative.** Context window pressure from a ~500-token static injection is unlikely to be a real problem for any modern LLM. Including it as a counter-metric suggests more analytical rigor than it delivers.

---

## Dimension 3: Strategic coherence

**Judgment: Strong**

### Strengths
- The thesis is explicit and well-articulated: prevention layer (prompt guidance) + correction layer (format guard). §1 Vision sets this up; §4 delivers it as two feature groups; §7 success metrics validate both sides.
- Features form a clean dependency chain: FR-12/FR-13 (assets) → FR-1/FR-2/FR-3 (guidance) → FR-10/FR-11 (naturalization) → FR-4–FR-9 (guard). Each group serves the thesis.
- §4.3 (Cooldown) serves the "像人" thesis rather than being a feature bolted on for completeness.
- Non-goals reinforce focus: "不做对话内容分析" clarifies that cooldown is message-counting, not sentiment analysis.

### Weaknesses

- **[MEDIUM] No quantified expectation for layer interaction.** The PRD describes two layers but doesn't estimate how much work each does. If prompt guidance prevents 90% of errors, guard catches 10% — that's one development prioritization. If guidance prevents 30%, guard is the primary mechanism — that's a different one. The PRD could note expected effectiveness ranges, even qualitatively ("guidance reduces most errors; guard handles the long tail").

---

## Dimension 4: Done-ness clarity

**Judgment: Adequate — bimodal**

The PRD has excellent done-ness for one half (Format Guard) and fuzzy done-ness for the other half (Prompt Guidance, Cooldown).

### Strong done-ness (Format Guard)
- FR-4–FR-8: Each has a specific input→output transformation. An engineer can write a unit test from each FR directly.
- FR-9: Clear negative criteria — "不包含表情相关内容的消息原样通过，零修改."
- FR-12: Exact filenames listed.
- Priority ordering specified (FR-4→FR-5→FR-6→FR-7→FR-8).

### Fuzzy done-ness (Prompt Guidance, Cooldown)

- **[HIGH] FR-1 done-ness is about text existence, not system behavior.** "Agent 在整个会话周期内都能访问到完整的表情包列表" — what does "access" mean observably? The real test is "Agent's response references sticker names from the injected list in appropriate contexts," but this is LLM-stochastic and hard to assert deterministically. The PRD should at least specify the injected text content (or reference a specific source document that defines it).

- **[HIGH] FR-11 is entirely hypothetical.** All three testable results are wrapped in `[ASSUMPTION]` tags. The mechanism (which hook), the window size (5 messages), and the state storage (which API) are all TBD. An engineer cannot implement FR-11 from this specification — they'd need to wait for architecture to resolve all three assumptions first. This is honest (the assumptions are tagged), but it means FR-11 is a *placeholder* for a requirement, not a requirement itself.

- **[MEDIUM] FR-3 specifies concepts, not text.** "指南包含'不必每次都发表情'的明确指示" — an engineer knows the concept but not the wording. For prompt engineering, the exact phrasing matters (e.g., "不要每次都发" vs. "大约30%的场景考虑发送" vs. "用你的判断" produce different LLM behaviors). The PRD should either pin the wording or explicitly delegate it to architecture/implementation with a note.

- **[MEDIUM] FR-10's second criterion is unfalsifiable.** "同一场景的连续触发中，Agent 不会每次都发表情" — this is a probabilistic statement about LLM behavior. No number of observations can prove it (the Agent might just happen to send every time in a small sample). Rewrite as: "Injected prompt text includes explicit probability guidance" (verifiable) + "In a 20-message test sequence with repeated matching scenes, sticker frequency < 100%" (falsifiable with a threshold).

---

## Dimension 5: Scope honesty

**Judgment: Adequate**

### Strengths
- `[ASSUMPTION]` tags are used honestly — each marks a real unknown, not a fait accompli disguised as a question.
- Non-goals (§5) do real work: "不做表情包生成" preempts an obvious feature-creep direction; "不修改非表情内容" is a genuine safety constraint.
- §6.2 MVP-beyond items have version targets (V2, V2+) and rationale.
- The PRD openly hardcodes everything for V1 (D-008) — honest about the maturity level.

### Weaknesses

- **[HIGH] Prior art not referenced.** The sticker-comprehensive-guide documents a validation script (`validate-media-format.py`) with a defined interface (stdin/exit code) that implements the same logic as FR-4–FR-8. This is a ready-made test oracle and reference implementation. Omitting it risks the engineering team re-deriving regex patterns from scratch and missing edge cases the script already handles. The guide also documents a prior plugin attempt that failed due to the scan-path constraint — this validates the clawhub distribution decision but the lesson isn't recorded.

- **[MEDIUM] Sticker quality criteria gap.** FR-12 requires "合格的 PNG 图片，可在 WeCom 中正常渲染" but the source guide documents 10 deleted stickers with specific failure reasons: watermarks, text overlay, cropping, low resolution, duplication. These failures define implicit quality acceptance criteria that FR-12 doesn't capture. This matters less for V1 (the 7 stickers already pass) but is a latent gap for V2 (user-uploaded stickers) and for the planned `angry.png`/`cute.png` additions.

---

## Dimension 6: Downstream usability

**Judgment: Adequate**

### Strengths
- FR numbering (FR-1–FR-13) is continuous with no gaps.
- SM links back to FRs explicitly ("验证 FR-4, FR-5, FR-6, FR-7, FR-8").
- §3 Glossary has 7 terms, all used consistently throughout the document.
- §4 feature groupings (Guidance, Guard, Cooldown, Assets) map naturally to implementation stories.
- §9 packaging section is concrete enough for an engineer to set up the project skeleton.

### Weaknesses

- **[MEDIUM] Glossary uses both Chinese and English for the same term.** "Operator（运营者）" is defined and used consistently, but the dual-language convention should be explicitly noted as the pattern. §2.1 uses "运营者" in prose; §9.3 uses "运营者" — consistent. "Format Guard（格式守卫）" same pattern. No actual drift detected, but the convention itself should be stated once.

- **[LOW] Source document delegation is imprecise.** §0 says "技术实现细节参见 `docs/sticker-format-guard-plugin-prompt.md` 和 `docs/sticker-comprehensive-guide.md`" but doesn't specify which content from those docs should be literally included in the injected prompt vs. treated as design reference. An architect extracting FR-1 needs to know: does the injected guide literally use the wording from sticker-comprehensive-guide §2.3, or does the plugin author write new text covering the same concepts?

- **[LOW] No cross-reference to reconciliation reports.** The PRD directory contains `reconcile-sticker-guide.md` and `reconcile-sdk-overview.md` which surface important gaps, but the PRD itself doesn't reference them. An architect or story writer picking up the PRD would miss these unless they explore the directory.

---

## Dimension 7: Shape fit

**Judgment: Strong**

### Strengths
- ~300 lines for a 2-feature plugin is proportionate — no inflation, no starvation.
- No over-formalization: no sequence diagrams, no class hierarchies, no API schemas. The PRD stays at product-requirement level and correctly delegates implementation to architecture.
- No under-formalization: FRs have testable criteria, not just vibes.
- §9 (Packaging & Distribution) provides a concrete install command and config block — appropriate for a developer product.
- The NFR section (§8) has 4 subsections, each plugin-specific. A generic product would have 8–12 NFR categories; a plugin needs only what's relevant.

### Weaknesses
- **[LOW] §4.3 Cooldown may be over-designed for V1.** Three assumption-tagged mechanisms for a V1 plugin that hardcodes everything else. The PRD could have said "Cooldown: suppress consecutive sticker sends; mechanism TBD in architecture" and saved ~20 lines of speculative mechanism discussion. The detailed mechanism options are valuable but belong in an architecture doc, not the PRD.

---

## Mechanical Notes

### Glossary Consistency
- **Operator（运营者）**: Defined §3, used consistently in §2.1, §2.3, §5, §8.3, §9.3. ✅
- **Sticker（表情包）**: Defined §3, used consistently. ✅
- **Format Guard（格式守卫）**: Defined §3, used in §4.2, §4.3, §8.1, §8.2. ✅
- **MEDIA 指令**: Defined §3, used consistently. ✅
- **Cooldown（冷却）**: Defined §3, used in §4.3, §5, §6.2. ✅
- **Prompt Guidance（Prompt 引导）**: Defined §3, used in §4.1, §8.1. ✅
- **Scene-Sticker Mapping（场景-表情映射）**: Defined §3, used in FR-2. ✅
- No glossary drift detected.

### ID Continuity
- FR-1 through FR-13: continuous, no gaps. ✅
- SM-1 through SM-4, SM-C1, SM-C2: consistent naming scheme. ✅
- UJ-1, UJ-2: continuous. ✅

### Broken Cross-references
- §0 → `docs/sticker-format-guard-plugin-prompt.md`: exists. ✅
- §0 → `docs/sticker-comprehensive-guide.md`: exists. ✅
- FR-9 → "FR-4 → FR-5 → FR-6 → FR-7 → FR-8": all exist. ✅
- SM-1 → "FR-4, FR-5, FR-6, FR-7, FR-8": all exist. ✅
- SM-3 → "FR-1, FR-12, FR-13": all exist. ✅
- SM-4 → "FR-3, FR-10, FR-11": all exist. ✅
- No broken cross-refs detected.

### Assumptions Index Roundtrip
§11 lists 7 assumptions. Cross-checking against inline `[ASSUMPTION]` tags:

| §11 Entry | Inline Location | Match |
|-----------|----------------|-------|
| §4.3 FR-10: 概率表述 | FR-10 line | ✅ |
| §4.3 FR-11: 冷却窗口 5 条 | FR-11 assumption block | ✅ |
| §4.3 FR-11: 混合方案 | FR-11 assumption block | ✅ |
| §4.1 FR-1: registerMemoryPromptSupplement | FR-1 assumption block | ✅ |
| §9.3: 权限标志 | §9.3 assumption block | ✅ |
| §4.4 FR-13: stickers/v2/ 部署 | FR-13 assumption block | ✅ |
| §10 Q5: per-session 隔离 | §10 Q5 inline | ✅ |

All 7 assumptions round-trip correctly. ✅

### Reconciliation Report Sync
The two reconciliation reports (reconcile-sticker-guide.md, reconcile-sdk-overview.md) were generated against what appears to be an earlier draft. Several gaps they flagged have since been addressed in the current PRD:
- Default sticker pool rule (now in FR-2 line 82) — reconciliation said "GAP", but current PRD has it.
- `allowPromptInjection` (now in §8.4, §9.3) — reconciliation said missing, current PRD has it.
- `enqueueNextTurnInjection` (now mentioned in FR-11 assumption) — reconciliation said not evaluated, current PRD considers it.

Remaining unaddressed gaps from reconciliation reports are captured in findings above (existing documents, validation script, quality criteria, content-rewrite semantics).

---

## Finding Summary

| # | Severity | Dimension | Section | Finding |
|---|----------|-----------|---------|---------|
| F-1 | CRITICAL | Decision-readiness | §4.2, §10 | `message_sending` content-rewrite capability assumed but not verified against SDK. Only `cancel` semantics are documented. If rewriting isn't supported, the Format Guard architecture is invalid. Must be added as a blocking open question. |
| F-2 | HIGH | Scope honesty | §4.1, §10 | No integration story with existing sticker-rule documents (SOUL.md, AGENTS.md, MEMORY.md, config/daily-report-template.md, stickers/README.md). Plugin may duplicate or conflict with already-loaded rules. Must be raised as an open question. |
| F-3 | HIGH | Done-ness | §4.3 FR-11 | All testable results are wrapped in `[ASSUMPTION]`. FR-11 is a placeholder, not a specification. Engineer cannot implement without 3 architectural resolutions first. |
| F-4 | HIGH | Done-ness | §4.1 FR-1 | Done-ness criteria describe text existence, not observable system behavior. "Agent can access the guide" is not testable without defining what "access" means. |
| F-5 | HIGH | Scope honesty | §4.2, §9 | Prior art not referenced: validation script (`validate-media-format.py`) as test oracle, prior plugin failure (scan-path constraint) as architectural lesson learned. |
| F-6 | MEDIUM | Substance | §7 SM-4 | "自然感主观评估" is not falsifiable. No instrument, threshold, or collection method. Recommend converting to a proxy metric or design principle. |
| F-7 | MEDIUM | Done-ness | §4.1 FR-3, FR-10 | Prompt text concepts specified but not wording. For prompt engineering the phrasing matters; the PRD should either pin it or explicitly delegate with a note. |
| F-8 | MEDIUM | Scope honesty | §4.4 FR-12 | Sticker quality acceptance criteria (no watermarks, no text overlay, minimum resolution, no duplicates) not derived from documented deletion history. |
| F-9 | MEDIUM | Strategic coherence | §4.1, §4.2 | No quantified expectation for layer interaction (what % of errors does guidance prevent vs. guard catch). Affects development prioritization. |
| F-10 | LOW | Shape fit | §4.3 | Cooldown mechanism over-specified for PRD level; detailed hook/API options belong in architecture doc. |
| F-11 | LOW | Downstream | §6 | Reconciliation reports in same directory not cross-referenced from PRD. Downstream consumers may miss critical gap analysis. |
