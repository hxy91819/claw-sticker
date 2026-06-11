# Structural Review — PRD: Claw Sticker

**Reviewer model:** Strategic/Context (Pyramid) — top-down, recommendation-first  
**Purpose:** PRD for a developer-facing OpenClaw community plugin  
**Audience:** Plugin developers and OpenClaw community contributors  

---

## Document Summary

| # | Section | Lines | Est. Words (zh) | Role |
|---|---------|-------|------------------|------|
| 0 | 文档目的 | 10–12 | ~90 | Executive frame: scope, audience, reading key |
| 1 | 愿景 | 14–20 | ~160 | Problem statement + solution thesis |
| 2 | 目标用户 (2.1–2.4) | 22–47 | ~330 | Persona, JTBD, non-users, user journeys |
| 3 | 术语表 | 49–57 | ~150 | Glossary of 7 terms |
| 4 | 功能 (4.1–4.4) | 59–197 | ~1150 | Core FRs: Prompt Guidance, Format Guard, Cooldown, Assets |
| 5 | 明确非目标 | 199–206 | ~130 | Scope fence — 6 items |
| 6 | MVP 范围 (6.1–6.2) | 208–225 | ~150 | In/out checklist |
| 7 | 成功指标 | 227–242 | ~180 | SM-1 to SM-C2 |
| 8 | 跨域非功能需求 (8.1–8.4) | 244–266 | ~200 | Perf, reliability, observability, compat |
| 9 | 插件打包与分发 (9.1–9.3) | 268–305 | ~280 | Manifest, build, install with code blocks |
| 10 | 开放问题 | 307–313 | ~250 | 5 open questions |
| 11 | 假设索引 | 315–323 | ~180 | 7 assumption references |
|   | **Total** | 324 lines | **~3250** | |

---

## Recommendations

### R-1 · MERGE · §2.3 "V1 非目标用户" + §5 "明确非目标" + §6.2 "MVP 之外" → single scope-fence section

**Rationale:** Three separate sections all answer the same question — "what is NOT in V1?" — from slightly different angles (user segments, feature exclusions, backlog deferrals). The reader encounters scope-fencing information at lines 36–39, again at lines 199–206, and a third time at lines 219–225. Merging into one authoritative "V1 Scope Fence" section (after Features) eliminates the triple pass and makes scope decisions scannable in one place.

**Impact:** HIGH — removes ~200 words of near-duplicate content; prevents the most common reader complaint on this document ("didn't we already say this?"). Estimated reduction: ~150 net words after dedup.

---

### R-2 · MOVE · §3 "术语表" → appendix or end-of-document reference

**Rationale:** Under the Pyramid model, glossaries are reference material, not strategic context. Placing it between §2 (users) and §4 (features) interrupts the top-down flow at the exact point where the reader wants to see *what the plugin does*. Developers who already know the terms skip it; those who don't can follow a link. The 7 terms are all used self-explanatorily in-context (e.g., "Format Guard（格式守卫）" in §4.2's heading).

**Impact:** MEDIUM — improves reading flow at the critical users→features transition. Zero content loss; terms remain accessible via anchor link.

---

### R-3 · CONDENSE · §9 "插件打包与分发" — cut implementation-level detail

**Rationale:** §9.1–9.3 contains manifest field names, JSON config blocks, and CLI commands. For a PRD audience, the relevant information is: (a) the plugin ships as a standard clawhub package, (b) it requires two permission flags. The 15-line JSON block (lines 291–304) and the build toolchain specifics (ESM bundle, `runtimeExtensions` pointer) are architecture/implementation decisions, not product requirements. The long `[ASSUMPTION]` paragraph at line 305 further suggests these details are premature.

**Impact:** HIGH — removes ~150 words of implementation detail that belongs in architecture docs or the plugin's README. Keeps the PRD focused on *what* and *why*, not *how to install*.

---

### R-4 · MERGE · §10 "开放问题" + §11 "假设索引" → single "Open Questions & Assumptions" section

**Rationale:** Both sections track uncertainty. §10 lists questions that need answers; §11 lists inline `[ASSUMPTION]` markers with their locations. In practice, every §11 assumption corresponds to or is entailed by a §10 question (e.g., Q1 covers the same ground as §11 items 2–4). Merging them into a single table with columns [ID, Topic, Current Assumption, Status/Owner] removes the cross-referencing burden and makes the uncertainty inventory scannable.

**Impact:** MEDIUM — removes ~100 words of redundant cross-references; gives stakeholders a single place to track decisions.

---

### R-5 · QUESTION · §4.3 "随机性与冷却" — does the section description repeat FR-10/FR-11?

**Rationale:** The section-level description (lines 153–155) restates almost verbatim what FR-10 and FR-11 then say individually. This is a pattern across all §4.x subsections: each has a "描述" paragraph that previews the FRs, then the FRs repeat the same points with "可测试结果". For §4.1 and §4.2, the descriptions add useful framing ("预防层" / "兜底层"). For §4.3, the description is pure duplication of the two FRs.

**Impact:** LOW — ~60 words. Could condense the §4.3 description to a single sentence linking to the "像人" rationale without re-explaining the mechanism.

---

### R-6 · PRESERVE · §0 "文档目的"

**Rationale:** This section is a textbook Pyramid opener: it names the audience, the scope, the document's two-pillar structure, and the reading conventions (`[ASSUMPTION]` markers, external doc links). It answers "should I read this?" in 3 lines. No changes needed.

**Impact:** N/A — already well-structured.

---

### R-7 · PRESERVE · §1 "愿景" + §2.1–2.2 "主要用户画像 / JTBD"

**Rationale:** Problem → solution thesis → persona → JTBD is clean top-down flow. The "两个层面" framing (引导层 + 兜底层) set up the entire feature section and recur throughout. User journeys (§2.4) are concrete and directly referenced by FRs. This is the strongest structural sequence in the document.

**Impact:** N/A — preserve as-is.

---

### R-8 · PRESERVE · §4 "功能" — FR numbering and testable-results format

**Rationale:** Global FR numbering (FR-1 through FR-13) enables unambiguous cross-references from success metrics, architecture docs, and test plans. The "可测试结果" blocks under each FR are crisp and directly verifiable. This is the backbone of the PRD.

**Impact:** N/A — the format is a strength.

---

### R-9 · CONDENSE · §7 "成功指标" SM-C1/SM-C2 rationale

**Rationale:** The counter-metrics (SM-C1, SM-C2) each include a "反制 SM-X" tag *and* a sentence explaining the trade-off. The sentence is useful, but the phrasing "不应为了提高 SM-3 而增加发送频率。频率过高会损害 SM-4 的自然感。反制 SM-3。" is circular — the tag already says "反制 SM-3". Tighten to one clause per counter-metric.

**Impact:** LOW — ~30 words. Improves density of an already-short section.

---

### R-10 · MOVE · §8.4 "兼容性" permission-flag detail → merge into condensed §9

**Rationale:** §8.4 lines 265–266 discuss `allowConversationAccess` and `allowPromptInjection` — the same flags detailed in §9.3. This splits a single permission story across two sections. After condensing §9 (R-3), fold the compatibility note about required flags into that section so the reader encounters the permission model once.

**Impact:** LOW — ~40 words moved; eliminates one cross-reference.

---

## Summary

| Metric | Value |
|--------|-------|
| Total recommendations | **10** (4 structural changes, 3 preserves, 3 minor tightening) |
| Actionable changes | **7** (R-1 through R-5, R-9, R-10) |
| Estimated net reduction | **~400–500 words (~13–15%)** after dedup and condensation |
| Sections to preserve as-is | §0, §1, §2.1–2.2, §2.4, §4 (FR structure) |

**Comprehension trade-offs:**

- The merge of three scope-fencing sections (R-1) is the highest-leverage change but requires choosing a single canonical ordering (recommend: feature exclusions → user-segment exclusions → deferred backlog).
- Moving the glossary (R-2) risks disorienting readers who expect it early. Mitigate with a one-line forward reference: "术语定义见附录 A".
- Condensing §9 (R-3) assumes architecture docs will carry the implementation detail. If no arch doc exists yet, keep §9.2 as a placeholder with a `[TODO: move to arch doc]` marker.
