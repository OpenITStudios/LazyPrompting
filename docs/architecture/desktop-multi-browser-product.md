# LazyPrompting Desktop — Product Architecture v1

## Product boundary
LazyPrompting is a desktop control center for up to ten independent workspaces. It visualizes sessions, browser workspace views, prompt dispatch status, host capability and recovery. ChatGPT owns the user task context and project work. LazyPrompting does not access project GitHub, copy ChatGPT cookies, scrape ChatGPT Web, or claim unattended control of existing chats.

## Reference provenance
Read-only reference: OpenITStudios/M-Minecraft-Emulator Local @ f24a1aad133ad80eb15d779545805769eca492f4. Adopt *patterns* of Tauri desktop shell, UI/engine separation, isolated instance presentation, settings, explicit lifecycle/error evidence, and per-instance identity. Do not copy Minecraft process controllers, Windows sandbox internals, account storage, or login behavior.

## Architecture
- Desktop shell: Tauri 2 with a Svelte 5/TypeScript UI, native Rust backend reserved for authorized OS/browser lifecycle integration. This first increment is a frontend-only skeleton and pure typed state.
- Core engine: existing src/prompt, src/runtime, src/browser modules remain canonical owners; frontend imports only serializable projections, never mutable engine objects.
- Workspace identity: 10 slots; workspaceId stable, sessionId opaque, selected workspace independent from dispatch order. One in-flight prompt per workspace.
- Browser modes: UNBOUND (default), PREVIEW_ONLY (safe mock visual), MANAGED_SUPPORTED_HOST (requires future documented admission). Existing public HTTPS browser adapter remains separate and opt-in.
- Native surface: no ten fully rendered persistent webviews in v1. Prefer one active preview + background session controllers where supported; hard caps for CPU/memory and browser process count. Use one user-controlled browser profile and shared authentication session across workspace tabs/views; isolate workspace metadata and conversation routing, not browser credentials. Never clone cookies or automatically sign in.
- Data ownership: app persists only workspace mapping, UI layout, minimized lifecycle metadata and limited health summary. Original ChatGPT content remains with ChatGPT; no transcripts in app storage.
- Dashboard: left rail workspace slots, central selected workspace status, right operator activity and queue; fixed status vocabulary. Settings: General, Browser/Resources, Data/Privacy, Keyboard, Notifications.
- Real ChatGPT transport: disabled until a documented authorized provider for existing consumer ChatGPT sessions is proven. UI may show NOT_CONNECTED and demo state, not claim live automation.

## Workflow
1. Create workspace and assign independent visual label
2. Bind an admitted browser/session provider explicitly, or leave UNBOUND
3. Confirm scope and permissions; show identity + resource budget
4. Observe authenticated state; queue only eligible dispatch
5. On send receipt move to next workspace without waiting for response
6. Verify terminal response; evaluate progress; report blockers; recover safely

## Validation / stop gates
- UI source and state contracts first. Tests authored but not run by user request.
- No native Windows runtime success, no browser session success, no login or ChatGPT transport assertions.
- Do not run CI, local tests, launch browsers, alter another repository, or add undocumented ChatGPT Web control.
- Next: implement Tauri command allowlist and native instance lifecycle for explicitly approved browsing before integrating any real host.

## Approved correction — shared login, 2026-11-10
- One user account, one browser profile, one browser-managed authentication state; up to ten distinct conversation/workspace identities.
- Prefer a single browser process/context with independently addressable tabs/views; multiple windows may reuse the same profile if supported. Do not require per-workspace login or copy session tokens.
- Workspace isolation is logical (conversation ID, queue, status, prompts, selected tab), **not a browser security boundary**. Cross-tab cookies and same-origin state are intentionally shared.
- Sign-in is manual and browser-owned. LazyPrompting must never collect, persist or extract credentials/cookies. Logout affects all workspace views using that profile.
- Distinct conversation binding and automatic prompt operations still require documented host capability; shared login does not authorize ChatGPT Web automation.

## AI-native browser efficiency — Lightpanda + Jev patterns (16 November 2026)

**Product choice:** preserve Chrome-style WebView2 for the human.
Use Lightpanda as the separate, optional headless automation candidate;
use Jev Ultrafast's **concepts**, not its proprietary hosted model,
as an indexed decision-space reference. Code Mode composes bounded,
host-admitted read-only steps without a second authorization owner.

**What is source-authored now (NOT_EXECUTED):** the opt-in Node
`LightpandaCdpAdapter.snapshot(workspaceId,"index")` reads one
`LP.getSemanticTree({format:"text",interactiveOnly:true})` result
through an already-open, localhost-preview-only CDP connection.
Its projection removes backend node IDs, attributes, input contents,
selectors and obvious sensitive labels, then returns at most 36
numbered, textual control descriptions and 4,096 UTF-8 bytes.
Indexes are **display only** and are never accepted as click targets.
No model call, screenshot, automation effect, new browser process,
network egress or state store is introduced. Default metadata
`snapshot` is backward compatible. The optional `view:"index"`
parameter on the existing gateway `lightpanda.snapshot` remains
behind its original host admission; the installed Rust native
Lightpanda path explicitly rejects indexed mode until it has
separate verified implementation and admission.

**Runtime and capability limits:** the current WSL Lightpanda native
relay is pinned, runs in a private network namespace and only serves
the local `/browser-preview.html` fixture. This is NOT a public-site
AI browser and is unrelated to the browser-managed login in WebView2.
The installed version may not implement `LP.getSemanticTree`;
missing support returns `LIGHTPANDA_CONTROL_INDEX_UNAVAILABLE`,
not a guessed fallback, UI scrape, or broadened network access.
Code Mode's public allowlist still has no browser navigation/page
content or effect permission. The existing WebView2 one-shot
AX observation for approved supporting tabs is a separate
permission-gated native owner; do not bridge it to consumer ChatGPT
or silently reuse display indexes as executable handles.

**Why not embed the original Jev experiment:** it uses the TypeSafe
Jev API and a separate text-model API, plus a Chrome harness. Its
sample 7.1 s Flights result and three-pair comparison measure one
workflow, not our installed agent/task success. Browser Use now
provides ultrafast mode, including a hosted option, but it is a
distinct provider/service with data, region, cost, and consent
considerations. No provider keys, installation, registration,
credentials, model or billing are changed in this increment.

**License checkpoint:** Lightpanda's upstream browser declares
AGPL-3.0-only; review source/distribution/network-service obligations
before bundling or modifying for a commercial release. Jev's original
example repository is MIT licensed, but that does not license the
TypeSafe API or Browser Use Cloud. Reference design is not adoption.

**Gate for a real AI browser, still HELD:** pin browser binary and
supported CDP methods; validate public HTTPS origin allowlist,
DNS/egress isolation, compliance, per-workspace lease and approval;
bind one fresh observation to an exact document epoch and native
element handle; prohibit password/secret/privileged target exposure;
authorize one typed operation only through native STOP/reservation;
verify its outcome independently before another action. Do not
treat model DONE as QA. No automation for ordinary ChatGPT consumer
sessions without a separately verified authorized transport.

**Measure efficiency later on the user's PC:** compare the same
consented benchmark tasks across metadata, indexed, AX-delta
and optional visual modes, recording task success, request/response
bytes, actual model tokens, LLM/tool calls, wall time, process
RAM/CPU, stale-action holds and site compatibility. Never infer a
universal token saving or performance ranking from upstream demos.

**Original evidence:**
- https://github.com/browser-use/jev-ultrafast (experiment/limits)
- https://browser-use.com/posts/bu-ultrafast-is-live (hosted successor)
- https://lightpanda.io/docs/guides/markdown-axtree (semantic-tree API)
- https://lightpanda.io/docs/core-concepts/benchmarks (benchmark bounds)
- https://lightpanda.io/docs/run-locally/installation/system-requirements (Windows WSL)
- https://github.com/lightpanda-io/browser/blob/main/LICENSING.md (license)

## Indexed observation target identity and bounded reads — 16 November 2026

The **opt-in local-preview Node adapter only** reads the current
`LP.getSemanticTree({format:"text",interactiveOnly:true})` for
`view:"index"`. It displays up to 36 redacted controls / 4 KiB.
The returned `fingerprint` is now a per-workspace, per-navigation
**HMAC-SHA-256** comparison key over the sanitized list **and the
Lightpanda backend node ID sequence**. Its 256-bit random key exists
only inside the ephemeral adapter workspace slot and rotates on
navigation, load, crash and close events and explicit same-URL opens.
The original low-entropy backend node IDs, selectors and node handles
never appear in the response. Duplicate/out-of-range backend IDs are
rejected, not interpreted as interchangeable controls.

This closes a specific false-`unchanged` case: two elements with
identical visible role/label but different backend IDs must not share
a fingerprint. It does **not** make the fingerprint a stable DOM
identity, secret capability, click target or native grant; a document
can change without a navigation event, so every indexed request still
takes a fresh read before comparing an optional `sinceFingerprint`.
Only a fresh, same-key and same-generation match may return
`unchanged:true` with empty content. Reading and CDP session
creation are bounded by a 2.5-second maximum, with a bounded detach
cleanup. Timed-out requests cannot initiate a late semantic-tree read
or leave the workspace queue blocked; unknown outcomes fail closed.

**No action path is enabled.** Display ordinals remain non-executable,
Code Mode cannot invoke the browser capability, the existing native
Rust Lightpanda path denies indexed mode and only the local-preview
origin is available. This is a preparatory source gate for later
host-owned document/element revalidation, typed per-action STOP,
reservation, verified result and real public-origin network controls.
The user-visible Chrome-style WebView2 is untouched.

**Proof:** source-authored regressions for identical-label/new-node
mismatch, duplicate IDs, invalid fingerprint keys, hung CDP reads,
late session completion and workspace recovery: TEST_AUTHORED_NOT_RUN.
Actual pinned Lightpanda method support, Windows/WSL runtime, token
and CPU savings, QA and native action acceptance: NOT_EXECUTED.

Source API: https://lightpanda.io/docs/reference/cdp-lp-domain

## Read-only indexed target review — source increment (16 Nov 2026)

The JS local-preview Lightpanda adapter now supports
`reviewTarget(workspaceId,{expectedFingerprint,displayIndex,operation})`.
The existing gateway's experimental `lightpanda.review` uses the
same native admission callback as Lightpanda snapshots; it does not
create a fifth public MCP facade tool. Allowed proposed operations
are `CLICK` and `TYPE_TEXT`, but neither can execute.

The proposal is an exact fingerprint from the last observation,
index 1–36 and operation only. Unknown fields (including model-supplied
permission flags), stale/foreign fingerprint, wrong workspace, invalid
role/input type and truncated index fail closed. Review performs a
**fresh** `LP.getSemanticTree` read, then `LP.getNodeDetails` for
the matching private ID in one bounded CDP session. Node ID, role,
name, interactive flag, input type and document generation must
remain consistent. No backend node IDs, selectors or input values
appear in the public result: `status:NATIVE_ACTION_GRANT_REQUIRED`,
`actionAuthorized:false`, `resultVerified:false`,
`qa:NOT_EXECUTED`. This result is not permission or QA.

The JS local-preview allowed origin is now fixed to
`http://127.0.0.1:1425`, and the path to
`/browser-preview.html`; alternate loopback services are denied.
Installed Rust Lightpanda, confined Code Mode and public ChatGPT
consumer browsing remain **not connected** to indexed review.
No automatic click, form filling, public-site navigation, extra
browser, paid AI API or UI change is introduced.

A real external AI browser still needs host-authenticated scope,
verified binary + CDP methods, destination/egress controls,
sensitive-field/consent policy, one-use per-action STOP grant,
durable dispatch, same-target checks immediately before the
mutation, exact receipt, independently verified outcome and
recovery. This source increment supplies only the *pre-action
read-only* piece, not the complete action loop.

Tests for role/ID/label mismatch, stale snapshot, truncated
index, password input, cross-workspace replay, model-forged
grant, denied native and Code Mode paths, fixed origin and
failure after navigation are TEST_AUTHORED_NOT_RUN.
The actual WSL/Windows runtime, real Lightpanda version, network
isolation, token savings and browser E2E remain NOT_EXECUTED.

Official API: https://lightpanda.io/docs/reference/cdp-lp-domain

## AI browser completion path (16 November 2026)

The target is one economical, usable AI browser, with the existing
Chrome-style human WebView2 and separately authorized Lightpanda
headless engine. Retain four public MCP tool names, the confined
Code Mode, workspace ID, native STOP/grants and canonical recovery
and receipt owners. No second engine or permission plane.

| Gate | Required acceptance; **not yet executed** |
| --- | --- |
| B0 — Actual browser | Pinned WSL Lightpanda must run the real offline interactive fixture with node details, click and fill methods; NOT_EXECUTED at current HEAD |
| B1 — Native observation | Rust index and private native target witness are source-wired; installed semantic/CDP compatibility NOT_EXECUTED |
| B2 — Permission | Host-selected app-local outbox, exact sealed proof, one-use native grant and window confirmation are source-wired for the fixed offline fixture only; native consent/STOP acceptance NOT_EXECUTED |
| B3 — Action + recovery | One native offline checkbox click/search fill and independent before/after readback, verified persisted digest or uncertain hold are source-wired; installed effects/restart reconciliation NOT_EXECUTED |
| B4 — Public site policy | Explicit HTTPS allowlist/consent; URL redirect, DNS, egress, credential and sensitive-field restrictions verified |
| B5 — Code Mode | A bounded, host-admitted action request through the existing gateway; no ChatGPT consumer DOM transport |
| B6 — Quality and efficiency | Same-SHA Windows 1/2/5/10 workspace acceptance, error/STOP/restart cases, RAM/CPU, wall time and measured actual model tokens |
| B7 — Product delivery | Packaging, Lightpanda AGPL distribution review and separate release approval |

B0–B3 require a **working offline loop** before any network expansion.
The fixed local `/browser-preview.html` fixture now has a native
search field, checkbox and inert button; title and no-external-script
CSP remain. The WSL relay limits a sequence of response reads to
eight seconds from its last host write, while Rust checks an
eight-second RPC budget between WebSocket reads. Those checks
improve bounded waiting; they are not a guaranteed total deadline
for every fragmented write/read path. A separately ignored Rust
fixture now uses `LP.waitForSelector` plus `LP.getSemanticTree`,
because the sealed 1.0.3 binary predates `LP.waitUntil` (1.0.4).
Live compatibility remains to be verified when PC validation is selected.

**Current evidence:** code and fixtures only, `TEST_AUTHORED_NOT_RUN`.
Installed actions, live CDP compatibility, public-site sandbox,
independent QA, efficiency benchmarking and packaged acceptance
are not verified. Passing a source test never upgrades that status.
Consumer ChatGPT Web automation remains a separate, blocked host
and compliance gate; do not bridge login state into Lightpanda.

## Native indexed preview read — next source integration (16 Nov 2026)

The installed Tauri host now exposes `lightpanda_preview` action
`index` under the **existing main-window-only explicit operator
approval** and authenticated native pipe. No new browser, worker,
public MCP facade or permission store exists. The host mints a
**distinct one-use grant** for private
`lightpanda.snapshot.index`, which cannot be substituted by a
`lightpanda.snapshot` metadata grant. The gateway retains its
existing public capability name `lightpanda.snapshot` with
`view:"index"` and maps it to that private scope on the signed pipe.

Only the fixed offline preview URL is admitted. Native Rust invokes
`LP.getSemanticTree` and checks the current URL after the read.
The semantic tree is capped at 8 KiB text and its serialized JSON
at 12 KiB *before* the authenticated 16 KiB IPC frame. It travels
only through this pipe into the already-integrated
`lightpanda-control-index.mjs` redaction/projection owner.
The 256-bit **consumed grant** is the ephemeral HMAC key, so this
installed-native index has **no stable cursor or no-repeat mode**:
`sinceFingerprint` on the native route fails closed. Output is
limited to 36 redacted, display-only controls and 4 KiB content;
backend node IDs, values and raw semantic tree never reach MCP.
The opt-in JS local-preview adapter retains its own separate
cursor comparison logic.

The native `lightpanda.review` operation is still denied, and no
`LP.clickNode`, `LP.fillNode`, public HTTPS navigation or
ChatGPT consumer extraction is enabled. The only privilege
change is one explicitly operator-approved, preview-only read
through a distinct one-use grant. Confined Code Mode cannot call
the browser. Source fixtures cover grant alias/mismatch/replay,
raw-tree redaction, malformed payload, frame size and pinned
1.0.3 compatibility. These are authored, **NOT_EXECUTED**.
Actual Windows/WSL browser/index verification and B1 acceptance
remain **NOT_EXECUTED**.

Publisher evidence:
- https://github.com/lightpanda-io/browser/releases/tag/1.0.3
- https://lightpanda.io/docs/reference/cdp-lp-domain

## Target-bound B2 grant contract — 16 Nov 2026

The existing `LightpandaGrantStore` (not a new permission store)
now has an internal, single-use target-grant scope: workspace,
fixed offline preview origin, native document epoch, sanitized
snapshot fingerprint, private node ID, control role, CLICK or
TYPE_TEXT, text SHA-256 digest when applicable, and reservation
nonce. Click applies only to button/checkbox; text input only
to textbox/searchbox. Grants are OS-RNG-generated, require all
native operator/transport/compliance gates, and expire within
eight seconds. A failed scope comparison **consumes** the grant;
STOP/revoke invalidates it. Read/index grants cannot substitute
for action grants.

**Not yet permission to act:** the scope's fields are private and
there is no production constructor, trusted live reviewer, durable
reservation producer or issuer/consumer connected to any UI,
gateway, Code Mode or CDP action. The native index fingerprint
currently uses a one-use grant-derived key, so its identity is
not reusable for an action. A nonzero reservation nonce is only
a structural check, NOT evidence of an actual outbox reservation.
Until a native `LP.getNodeDetails` reviewer and existing durable
outbox are both linked to the same document and target, B2
remains **SOURCE_IN_PROGRESS** and executable grants remain OFF.
B3 will additionally need one dispatch, independent read-back,
uncertain-result recovery and STOP.

Negative Rust fixtures (not executed) cover wrong scope, grant
alias, workspace, epoch, node, role, operation, text digest,
reservation, TTL and STOP. No Windows/WSL/QA result exists on
this new source.

## B2 native read-only offline target inspector — 16 Nov 2026

The existing private Rust `PrivateLightpanda` now contains an
**internal-only** `review_offline_control` for the three
literal controls owned by the offline `browser-preview.html`
fixture (button, checkbox and search input). It has no
renderer/Tauri, public MCP, gateway, Code Mode, model-tool or
grant-issuer entrypoint. No new permission manager is created.

The inspector validates the current fixed preview URL and
a pre/post `performance.timeOrigin` marker via read-only
`Runtime.evaluate`, obtains one bounded
`LP.getSemanticTree({format:"text",interactiveOnly:true})`,
resolves exactly one backend ID by matching a fixed, known
role/name (missing/ambiguous/out-of-range targets fail),
and calls `LP.getNodeDetails` to cross-check the exact ID,
role, accessible label, interactivity, tag and safe input type.
Disabled controls or password types deny. CDP details are
**not** serialized into the returned receipt: only
role/label, `NATIVE_ACTION_GRANT_REQUIRED`,
`actionAuthorized:false`, `resultVerified:false`
and `qa:NOT_EXECUTED`. A review never clicks, types,
fills, navigates or issues an action grant.

The read-only document marker detects ordinary same-URL reloads,
but it is **not a security-grade document identity** and can
miss arbitrary same-document DOM mutation. This controlled
fixture has no scripts; a real site requires a native
document-epoch authority and fresh-target revalidation
immediately before any granted effect.

The ignored sealed-WSL compatibility fixture now exercises
the actual `LP.getNodeDetails` method. Pure Rust negative
fixtures cover missing/duplicate IDs, changed role/label,
disabled input, password type, foreign URL and invalid epoch.
All are TEST_AUTHORED_NOT_RUN on this ChatGPT/GitHub surface.
The current private target-grant contract still has no
production constructor/reservation and B2/B3 runtime remains
held. No AGPL, public egress or ChatGPT Web permission is
implied by this source addition.

Primary CDP contract:
https://lightpanda.io/docs/reference/cdp-lp-domain

## Browser AI: durable intent in the canonical outbox (16 Nov 2026)

A future browser effect must be reserved **before** its native
`LP.clickNode` or `LP.fillNode` dispatch, and a missing or
ambiguous outcome must not be retried. Rather than adding another
state directory or shadow ledger, `src/prompt/prompt-outbox.mjs`
now stores an optional, strictly validated `browserActions`
collection in the **schema-v1 state file of each PromptOutbox instance,
exclusive lock, fsync and atomic publication** as prompt outbox items.
Old files without this optional collection continue to load.

`reservePreviewActionIntent` accepts only an exact canonical
workspace 01–10, positive document epoch, opaque 64-hex
snapshot/target digests, CLICK or TYPE_TEXT and (for typing)
a nonzero 64-hex text digest. The outbox generates the action ID
and 128-bit random reservation nonce; no raw backend node ID,
selector or entered text is persisted. Within one file, unresolved browser actions block overlapping
prompt/agent work. RESERVED, DISPATCH_PENDING and
RECONCILE_REQUIRED survive restart and prevent retry. This
does not guarantee cross-file exclusion: Codex outboxes use
per-task files until native workspace ownership is connected.

`matchReservedPreviewAction` checks one exact persisted identity
but returns `actionAuthorized:false` and
`resultVerified:false`. A correct nonce only proves the row
exists: it is **not** native consent, a durable effect receipt,
a cryptographic proof of a trusted caller or permission to click.
`pendingPreviewActions` gives a secret-free hold projection.
The existing prompt-only `pending` method remains compatible;
the Codex goal runner checks an outstanding browser action
before starting a new thread, and existing `reserve` /
`reserveAgentIntent` refuse overlapping work. The exact `sealPreviewActionDispatch` transaction first changes
RESERVED to DISPATCH_PENDING and denies a second seal.
`holdPreviewActionUncertain` then holds uncertain outcomes as
RECONCILE_REQUIRED, never VERIFIED. No host action is issued yet.

**Next necessary connection:** authenticated native review must
bind the indexed target to an exact digest/document epoch in the
real preview, then use the authenticated host to reserve the
action in this existing outbox and verify that persisted row
before issuing the existing target grant. B3 still requires
one dispatch, a native before/after receipt, independently
verified outcome, and reconcile-required hold for unknown
results. We have deliberately not added a model-enabled
browser action, an auto-ack from untrusted content, a new
permission controller, or a second state file.

Negative source fixtures cover legacy schema, strict shape,
cross-workspace replay, prompt/agent turn collision, restart
hold, corrupt/duplicated records and confidentiality.
`TEST_AUTHORED_NOT_RUN`; Windows/native and actual Lightpanda
effect/QA remain `NOT_EXECUTED`.

### Native on-disk dispatch proof — 16 November 2026

The original Rust `lightpanda_grants.rs` now has a read-only
verifier for the exact DISPATCH_PENDING browser row in a
host-selected PromptOutbox file. It checks canonical app-data
root, file size, no symlink leaf, schema, action uniqueness,
workspace, origin, epoch, snapshot and private-target digests,
UUID, nonce, operation and text digest. A mere RESERVED or
RECONCILE_REQUIRED row fails. The internal target scope now
includes the opaque target digest, never the backend node ID in
persistent storage.

Positive target grant issuance/consumption is **test-only** in
Rust and absent from the installed binary. The native owner
must still derive the target/epoch from a current browser,
choose and verify the correct outbox path, seal the intent,
issue one non-replayable grant and independently verify
the effect. No production caller, clicked control, completed
receipt or installed QA is implied. Source tests for replay,
wrong scope, forged status and out-of-root paths are authored,
NOT_EXECUTED.

### Private native document and target witness — 16 November 2026

For the owned offline preview only, the existing
`PrivateLightpanda` slot now has a native-generated random
document epoch, 256-bit private HMAC key and last observed
document marker. `review_offline_control` now delegates to a
private inspection result that binds the current
`LP.getSemanticTree`, `LP.getNodeDetails` backend ID, role,
label, workspace and document marker to **separate,
domain-separated HMAC fingerprints**. The marker is checked
before and after review; a different marker rotates the
private key and advances the epoch. The private witness
cannot be serialized through the public read-only receipt.

This is necessary for a later host-owned outbox
`snapshotFingerprint`/`targetDigest` and one-use grant
that cannot be reconstructed from display indexes.
However, `performance.timeOrigin` is still only a
navigation heuristic, not a security-grade document epoch
for arbitrary scripted sites. The native indexed public
snapshot currently uses a different per-read grant key:
there is **no automatic equivalence or promotion of its
fingerprint to an action grant**. A private, current-document
witness and a matching durable reservation must still
be atomically correlated by the native host.

HMAC/epoch negative fixtures are authored but NOT_EXECUTED.
No click/fill, public website, Code Mode action or ChatGPT
consumer automation is enabled.

## Offline Browser AI native action source checkpoint — 16 November 2026

This section **supersedes earlier source-stage statements** above that
positive grants, effects or durable successful receipts were not yet
connected. It does not supersede any installation or policy hold.

For the exact, no-external-script `browser-preview.html` fixture,
`lightpanda_preview_action` is a main-window-only Tauri entrypoint
requiring one Windows operator confirmation per operation. A model,
MCP client or browser page cannot provide a backend node ID, action
grant, URL or selector. Native Rust reads `LP.getSemanticTree` and
`LP.getNodeDetails`, checks the fixed target and document marker,
and derives private HMAC snapshot/target digests. The native document
epoch is now OS-random and JS-safe (at most `2^53-1`) for the
existing `PromptOutbox` schema.

In the canonical `app_local_data_dir()/outbox.json`, the existing
atomic `PromptOutbox` reserves an exact `browserActions` row with
an OS-random action ID and nonce. The private Node gateway accepts
native-originated `reserve|seal|verify|hold` requests only; no new
public MCP or Code Mode tool exists. After the row is sealed to
`DISPATCH_PENDING`, the Rust host verifies its exact persisted
workspace, origin, epoch, target/snapshot digests, operation, text
digest, action ID and nonce. It issues/consumes a one-use scope from
the original `LightpandaGrantStore` before one native
`LP.clickNode` checkbox toggle or `LP.fillNode` search-input fill.
There is no automatic retry on ambiguous dispatch.

Native Rust independently reads the fixed fixture's before/after
control state using constant, non-user-selected expressions. The
`VERIFIED` response from the gateway is accepted only when Rust
independently checks the matching, persisted `resultDigest` record
at the trusted app-local outbox. A completed historical row does
not block the next reservation in the same workspace; unresolved
rows remain exclusive. Errors after reservation attempt a
`RECONCILE_REQUIRED` hold. If the gateway is unavailable during
that hold, the original pending row is preserved and the outcome is
not promoted. No completion can be inferred from the rendered UI.

**Proof ceiling:** these are GitHub-committed source contracts and
authored negative fixtures, **NOT_EXECUTED** on the current HEAD.
The installed Windows host, packaged Node, signed Lightpanda binary
and its `LP.clickNode`/`LP.fillNode` availability, actual STOP race,
readback accuracy, restart recovery, concurrent Codex per-task outboxes,
1/2/5/10 workspace performance and user experience are unverified.
Unknown post-dispatch operations deliberately block further work;
a safe operator reconciliation path with independent evidence remains
necessary for general usability.

**Do not extend this fixed fixture authorization to public sites.**
`performance.timeOrigin` is only a heuristic on arbitrary scripted
webpages, public HTTPS origin/redirect/DNS/egress and secret policies
are not accepted, Code Mode has no effectful browser capability and
unattended ordinary ChatGPT Web automation remains blocked.
Lightpanda AGPL packaging and commercial release remain separately
reviewed gates. See [deferred exact-revision acceptance](../validation/localtest-readiness.md).

### Native result-binding refinement — 16 November 2026

The fixed-fixture completion digest is no longer computed from a
static sanitized `status:verified` JSON receipt. After a single
native-granted operation, Rust derives a separate domain-separated
HMAC with its private session key over the exact private target
witness and **actual after-state readback**, without returning or
persisting the raw search value. The durable `resultDigest` then
binds this native proof to the action ID, target digest and random
reservation nonce. The gateway may return only the sanitized
`OFFLINE_FIXTURE_ONLY` public receipt, and Rust independently checks
the matching durable row before displaying success. Source negative
fixtures cover changed after-state and mismatched target proofs.
No test was run on the current GitHub work surface; CDP behavior and
Windows compatibility remain NOT_EXECUTED.
