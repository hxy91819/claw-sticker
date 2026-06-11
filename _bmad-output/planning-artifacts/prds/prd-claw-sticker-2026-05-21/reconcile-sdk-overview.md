# PRD ← SDK Overview Reconciliation Review

**Source:** `sdk-overview-0.md` (Plugin SDK overview — registration API, hooks, capabilities, packaging)
**PRD:** `prd.md` (Claw Sticker V1 draft, 2026-05-21)
**Reviewed:** 2026-05-21

---

## Methodology

Each SDK detail was evaluated for relevance to claw-sticker (a hook-based plugin doing static prompt injection + message rewriting + session-state cooldown for WeCom sticker formatting). Irrelevant SDK areas (channel registration, provider registration, CLI backends, memory capabilities, gateway discovery, tool registration, etc.) are excluded.

---

## Gap 1 — `agentPromptGuidance` is command-scoped, not plugin-level

**SDK says:** `agentPromptGuidance` is set on commands registered via `api.registerCommand(def)`. The SDK text reads: *"Plugin commands can set `agentPromptGuidance` when the agent needs a short, command-owned routing hint."* It is a property of a command definition, not a standalone plugin-level registration API.

**PRD says (FR-1, §10 Q3, §11):** Treats `agentPromptGuidance` as a candidate for plugin-level static prompt injection, listed alongside `registerMemoryPromptSupplement` as possible implementation mechanisms.

**Gap:** The PRD conflates `agentPromptGuidance` with a general-purpose prompt injection API. To use it, the plugin would need to register a command (possibly a no-op or utility command like `/sticker-status`) and attach guidance to it. This changes the plugin's registration shape. Alternatively, `agentPromptGuidance` may simply be the wrong API choice for "always-on" sticker guidance, and the plugin should use `registerMemoryPromptSupplement` or `before_prompt_build` instead.

**Impact:** Architectural — affects the choice of injection mechanism for FR-1. The PRD's assumption that `agentPromptGuidance` provides a lower-permission alternative to `before_prompt_build` (§10 Q3) may be invalid if it requires command registration.

**Recommendation:** The PRD should either (a) explicitly plan to register a command as the guidance anchor and document this design, or (b) remove `agentPromptGuidance` from consideration and commit to `before_prompt_build` / `registerMemoryPromptSupplement`, updating the permission analysis accordingly.

---

## Gap 2 — `message_sending` hook: cancel semantics documented, content rewrite not

**SDK says:** Hook decision semantics for `message_sending` are documented as:
- `{ cancel: true }` — terminal, skips lower-priority handlers
- `{ cancel: false }` — treated as no decision (not an override)

The SDK does not document how a `message_sending` handler performs **content modification** (mutating the message body). Only `cancel` is covered.

**PRD says (§4.2, FR-4–FR-9):** Format Guard lives in `message_sending` and **rewrites message content** (not cancels it). The PRD assumes the handler can read and modify the outbound message text before it reaches the channel.

**Gap:** The PRD's core Format Guard design depends on content rewriting within `message_sending`, but the SDK overview only documents the cancel decision path. The PRD does not address:
- How content modification is actually performed (mutable context object? return value with modified content? specific field on the handler result?)
- Whether content rewrite by one handler is visible to lower-priority handlers
- Whether rewrite + cancel can coexist (a handler rewrites content but a later handler cancels)

**Impact:** High — if `message_sending` doesn't support content rewriting (only cancel), the entire Format Guard architecture needs rethinking. More likely: the SDK overview simply omits rewrite documentation, and the hooks reference page covers it. But the PRD should not assume capabilities undocumented in the SDK overview.

**Recommendation:** PRD should add a note that content rewrite semantics in `message_sending` need to be verified against the full [Plugin hooks](/plugins/hooks) reference. The open questions section should capture this explicitly.

---

## Gap 3 — `allowPromptInjection` flag not mentioned

**SDK says:** *"`allowPromptInjection=false` disables prompt-mutating hooks including `agent_turn_prepare`, `before_prompt_build`, `heartbeat_prompt_contribution`, prompt fields from legacy `before_agent_start`, and `enqueueNextTurnInjection`."*

This is a separate control from `allowConversationAccess`.

**PRD says (§8.3, §9.3):** Only discusses `allowConversationAccess: true` as the required operator permission for `before_prompt_build`. The installation config example (§9.3) shows `hooks.allowConversationAccess: true` but does not mention `allowPromptInjection`.

**Gap:** The PRD assumes `allowConversationAccess` is the only permission gate for prompt-mutating hooks. If `allowPromptInjection` is a separate flag that defaults to `false`, the plugin's `before_prompt_build` hook (used for both static guidance and cooldown suppression) would be silently disabled. The PRD needs to:
- Clarify the relationship between `allowConversationAccess` and `allowPromptInjection`
- Determine if `allowPromptInjection` also needs to be set in operator config
- Update the installation example in §9.3 if both flags are required
- Assess operator friction: two permission flags is worse than one

**Impact:** Medium-high — if this flag is needed and missing from install docs, the prompt injection features silently fail. This directly affects FR-1, FR-10, FR-11.

**Recommendation:** Add `allowPromptInjection` to open questions (§10). Update §9.3 installation config once the relationship is confirmed.

---

## Gap 4 — `enqueueNextTurnInjection` not evaluated for cooldown

**SDK says:** `api.session.workflow.enqueueNextTurnInjection(...)` provides *"Durable exactly-once context injected into the next agent turn for one session."* Available to external plugins.

**PRD says (FR-11):** Cooldown suppression uses `before_prompt_build` to inject a per-turn "don't send sticker now" signal when the session is in cooldown.

**Gap:** `enqueueNextTurnInjection` is a purpose-built API for exactly the use case FR-11 describes: injecting a one-shot context payload into the next turn. It may be architecturally cleaner than using `before_prompt_build` for cooldown because:
- It's declarative and durable (survives gateway restarts)
- It fires exactly once, matching the "suppress this one turn" semantic
- The `message_sending` hook (which detects sticker sends) can enqueue the suppression, creating a clean event→injection pipeline

However, it is also disabled by `allowPromptInjection=false` (see Gap 3), so it doesn't avoid the permission issue.

**Impact:** Medium — this is an alternative implementation path that may simplify the cooldown design. Not a correctness gap, but an architecture gap.

**Recommendation:** Add `enqueueNextTurnInjection` as a candidate mechanism in FR-11's assumption block and in §10 Q1. Evaluate it alongside `before_prompt_build` during architecture design.

---

## Gap 5 — Structured `agentPromptGuidance` surfaces not considered

**SDK says:** `agentPromptGuidance` supports structured entries with surface scoping:
```ts
agentPromptGuidance: [
  { text: "Only in PI main.", surfaces: ["pi_main"] },
]
```
Available surfaces: `pi_main`, `codex_app_server`, `cli_backend`, `acp_backend`, `subagent`. Unscoped guidance goes to all non-Codex surfaces. Codex only receives explicitly scoped guidance.

**PRD says:** No mention of surface scoping for prompt guidance anywhere.

**Gap:** If any prompt injection mechanism is used (whether `agentPromptGuidance`, `before_prompt_build`, or `registerMemoryPromptSupplement`), the sticker guidance is WeCom-specific and should not leak into Codex, CLI, or subagent contexts where sticker sending is irrelevant and wastes context window. The PRD doesn't address:
- Which prompt surfaces the guidance should target
- Whether `before_prompt_build` has equivalent surface filtering
- Risk of sticker instructions appearing in non-chat contexts

**Impact:** Low-medium — functional correctness isn't affected (Format Guard won't break in non-WeCom contexts), but unnecessary prompt content wastes tokens in Codex/CLI sessions and may confuse agents in those contexts.

**Recommendation:** Add a requirement or note that guidance injection should be scoped to chat/PI surfaces. If using `agentPromptGuidance`, use structured entries with `surfaces: ["pi_main"]`. If using `before_prompt_build`, add channel-type gating logic.

---

## Gap 6 — External plugin capability boundaries not verified

**SDK says:** External plugins can use: session extensions, UI descriptors, commands, tool metadata, next-turn injections, and normal hooks. Bundled-only capabilities include: trusted tool policies, reserved command ownership, tool-result middleware, `sendSessionAttachment`, `scheduleSessionTurn`.

**PRD says:** Implicitly assumes all needed APIs are available but doesn't explicitly verify against the external plugin boundary.

**Gap:** The PRD should confirm that every planned SDK API is available to external (community) plugins. Based on the SDK, the planned usage looks safe:
- ✅ `api.registerHook()` — available to external plugins
- ✅ `api.session.state.registerSessionExtension()` — available to external plugins  
- ✅ `api.session.workflow.enqueueNextTurnInjection()` — available to external plugins
- ✅ `api.registerCommand()` — available (if needed for `agentPromptGuidance`)
- ✅ `api.registerMemoryPromptSupplement()` — listed in infrastructure, not flagged as bundled-only

**Impact:** Low — verification confirms no blockers, but the PRD should document this as a resolved constraint rather than leaving it implicit.

**Recommendation:** Add a brief note in §8.3 or §9 confirming external plugin compatibility for all planned APIs.

---

## Gap 7 — Plugin manifest fields beyond basic structure

**SDK says:** Plugin manifest (`openclaw.plugin.json`) can include `channelConfigs`, and the SDK references setup/config documentation at [Setup and config](/plugins/sdk-setup). The import convention recommends `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry`.

**PRD says (§9.1):** Lists `id`, `activation.onStartup`, and empty `configSchema`. Doesn't reference other manifest fields or link to the SDK setup docs.

**Gap:** Minor. The PRD's manifest section is skeletal. While V1 has no config, the manifest may need additional fields the SDK setup docs specify (e.g., `version`, `description`, `hooks` declarations, `runtimeExtensions` path). The PRD should reference the SDK setup guide rather than listing fields ad hoc.

**Impact:** Low — implementation detail, not a product requirement gap.

**Recommendation:** Add a reference to SDK setup docs in §9.1 for complete manifest field coverage.

---

## Non-gaps (SDK details correctly captured or intentionally excluded)

| SDK detail | PRD status |
|---|---|
| `definePluginEntry` import path | Correctly referenced in §8.3 |
| `api.registerHook(events, handler, opts?)` | Used in §4.2 (Format Guard) and §4.3 (cooldown) |
| `api.session.state.registerSessionExtension(...)` | Referenced in FR-11 and §10 Q1 |
| `api.pluginConfig` for V2 configurability | Implicitly covered by §5 non-goals and §6.2 V2 plans |
| Hook priority via `opts` | Used in §4.2 (`priority: 100`) |
| `api.logger` for scoped logging | Not mentioned but not a product requirement |
| Provider/channel/tool registration APIs | Correctly excluded (not relevant to this plugin type) |
| CLI/gateway/discovery registration | Correctly excluded |
| Memory capabilities | Correctly excluded (except `registerMemoryPromptSupplement` as injection candidate) |

---

## Summary of action items

| # | Gap | Severity | PRD sections affected |
|---|---|---|---|
| 1 | `agentPromptGuidance` is command-scoped, not plugin-level | High | FR-1, §10 Q3, §11 |
| 2 | `message_sending` content rewrite semantics undocumented | High | FR-4–FR-9, §4.2 |
| 3 | `allowPromptInjection` flag not mentioned | Medium-high | §8.3, §9.3, §10 |
| 4 | `enqueueNextTurnInjection` not evaluated for cooldown | Medium | FR-11, §10 Q1 |
| 5 | Prompt guidance surface scoping not addressed | Low-medium | FR-1, §4.1 |
| 6 | External plugin boundary not explicitly verified | Low | §8.3, §9 |
| 7 | Manifest field coverage skeletal | Low | §9.1 |
