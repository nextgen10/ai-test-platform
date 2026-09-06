# Agent Hub — Production Hardening & Product Excellence Brief

> Revision 5 — 6 September 2026. Changes are marked **[r2]**–**[r5]**
> where an instruction reversed or a target moved, so anyone holding an older
> copy can see what no longer applies.
>
> **[r3]** re-audited against the tree after a working session. Epic E's
> "do this first" `.gitignore` change is now **applied**; the console renders
> documents as tables; the duplicated-payload bug is fixed; the agent rail is a
> dropdown. Two new findings, both about the brief being optimistic: the
> dead-code check assumes tooling that is not installed, and the mock engine
> does not honour its own agents' contracts.
>
> **[r4]** four more fixes landed, three of them bugs found by using the
> product rather than by reading it: reprocess was arithmetically impossible,
> the nav bar never stayed put, and one YAML list crashed the console. Plus one
> honest unknown — an intermittent test failure seen once and not reproduced.

You are working in the repository `ai-test-platform` (UBS Agent HUB): a
**generic multi-agent execution platform** with an onboarded test-generation
domain. Do not rebuild the platform. Improve what exists until it is coherent,
robust, and delightful to use.

---

## 0. Current state — verify, do not rebuild **[r2]**

These were open in r1 and are now done. **Confirm with the named test, then move
on.** Re-solving them is the main way this brief wastes a week.

| Already true | Where | How to confirm |
| --- | --- | --- |
| Jobs are leased rows; multi-replica safe | `services/queue.py` | `pytest tests/test_queue.py` |
| Abandoned jobs reclaimed; shutdown hands work back | `queue.abandon_in_flight` | `test_shutdown_hands_in_flight_work_straight_back` |
| Invalid agent output never passes as success | `runner/validate_output.py`, `schema_coerce.py`, `agent_io.check_contract` | `pytest tests/test_validate_output.py tests/test_schema_coercion.py` |
| Agent definitions validated before install | `hub_registry.validate_agent`, `POST /api/v1/hub/agents/validate` | `pytest tests/test_agent_validation.py` |
| Metrics for scraping | `GET /api/v1/metrics` | `curl -s localhost:8100/api/v1/metrics \| head` |
| Request id on every log line and every 500 | `main.py` middleware | `curl -i … \| grep X-Request-ID` |
| Auth surface removed (see §1) | proxy, `k8s/deploy.sh` | no `/api/auth/*` route exists |
| Workbench mounted in the console | `ChatPanel` → `AgentStudio` | `/chat` renders the workbench |
| **[r3]** Agent output renders as tables, not raw JSON | `JsonDocumentView`, Structured tab | run any contract-bound agent |
| **[r3]** Agents no longer emit the payload twice | `chat_orchestrator._console_framing` | `pytest tests/test_chat_api.py -k framing` |
| **[r3]** Agent picker is a dropdown, not a 240px rail | `AgentStudio` | `/chat` at desktop width |
| **[r3]** Repo hygiene is structural | `.gitignore` | `git status --porcelain -uall` lists only source |
| **[r4]** Reprocess works at all | `approve_job` / `start_reprocess` reset `attempt` | `pytest tests/test_queue.py -k budget` |
| **[r4]** Top nav stays put while scrolling | `AppShell` passes `pinned` | `/jobs` — header CSS is `position:fixed` |
| **[r4]** A fan-in agent cannot crash the console | `hub_registry.artifact_list` | `pytest tests/test_agent_validation.py -k artifact` |
| **[r5]** Suite is deterministic — no wall-clock waits | `_drive` / `_wait_for_terminal` | `pytest tests/ -q` runs in ~7s, not ~20s |
| **[r5]** Mock honours agent contracts | `chat_orchestrator._mock_contract_reply` | `pytest tests/test_chat_api.py -k contract_reply` |
| **[r5]** Artifacts are pruned on a policy | `services/retention.py` | `pytest tests/test_retention.py` |
| **[r5]** A fan-in stage checks its inputs exist | `generic_runner.missing_inputs` | `pytest tests/test_workflow_execution.py -k fan_in` |
| **[r5]** Reprocess says it is still running | `/jobs/[id]` banner + 'Cancel reprocess' | open a job mid-reprocess |
| **[r5]** Dead UI removed | `ChatInput`/`ChatMessage` deleted | `grep -r ChatInput frontend/src` finds nothing |

Backend baseline: **335 tests green** *(r4 said 323, r3 313, r2 310)*. Frontend:
`tsc --noEmit` clean, `next build` clean. Any slice that leaves either red is
not done.

---

## 1. Auth (non-goal — do not implement)

- **No authentication, login, OIDC, SSO, API tokens, or role RBAC work.**
- Keep `AUTH_MODE=disabled`. Do not restore fail-closed auth.
- Do not build `/login` flows, token gates, ownership checks, or "secure the
  demo" auth epics.
- **[r2]** *Removing* dead auth surface **is in scope and has already partly
  happened.* The tree no longer contains `/api/auth/login` or
  `/api/auth/session`, the BFF proxy forwards no credential, and `deploy.sh`
  mints no tokens. Do not revert this on the grounds that "no auth work ships" —
  that clause means *no auth is added or re-enabled*.
- Backend `Principal` / role plumbing stays in place, defaulted off and tested.
  The per-row ownership model is written against it. Leave it alone.

Security still matters at the **trust boundary**: requirement-as-data, no agent
`shell`/`fetch`, path-safe hub IDs, schema validation, workspace isolation,
NetworkPolicy/loopback as deployed. That is not "user auth."

---

## 2. Product north star

Users should be able to:

1. Open the **Agent Console**, pick any onboarded agent, run it, inspect output,
   and **pass that output to any next agent** in one session.
2. Run **workflows as jobs** when they need pipelines, approval gates, artifacts.
3. Onboard new agents/skills/workflows via the **Registry** without changing
   platform code.
4. Trust results: schema gates, provenance, clear failures, no silent empty runs.

Success: one mental model, no dead UI, UBS-faithful styling, solid job/chat
reliability, tests that catch regressions.

---

## 3. Load targets **[r2] — fill these in before starting Epic B**

Half of "robustness" is unfalsifiable without numbers. Confirm or change these;
everything in Epic B is measured against them.

| Dimension | Target | Consequence if unset |
| --- | --- | --- |
| Concurrent users | 10 | Chat slot sizing is guesswork |
| Concurrent jobs, platform-wide | 20 (`MAX_CONCURRENT_JOBS_TOTAL`) | Queue depth alerts have no threshold |
| Jobs per day | 200 | Artifact retention has no horizon |
| Acceptable queue wait, p95 | 60s | Cannot say whether the worker pool is too small |
| Job duration ceiling | 2700s (`JOB_TIMEOUT_SECONDS`) | Already set; confirm it matches reality |
| Orchestrator replicas | 2 | Decides whether per-process limits are a bug |

**Known consequence of the replica count:** chat concurrency caps
(`CHAT_MAX_CONCURRENT_PER_USER`, `CHAT_MAX_CONCURRENT_TOTAL`) are in-process
semaphores, so the true ceiling is the configured value **× replica count**. At
2 replicas that is acceptable and should be documented as per-replica. Above
roughly 4, move the counter into the database. Decide from the table, not taste.

---

## 4. Architecture constraints (do not violate)

- Layers: Control (`frontend/`) → Orchestration (`backend/`) → Execution
  (`executors/`, `k8s/`) → Generation (`runner/`) → Contract (`schemas/`,
  `agent-hub/`).
- **1 request = 1 Job** for workflows; chat turns are per-session messages.
- Hub filesystem is source of truth (`agent-hub/`).
- Prefer structured artifacts in job pipelines over free-text handoffs.
- Non-goals: auth/OIDC, autonomous deploy, unrestricted shell, multi-cluster,
  auto git PRs.

Read first: `docs/architecture.md`, `docs/adding-an-agent.md`,
`frontend/src/theme/index.ts`, `ChatPanel` → `AgentStudio` →
`ChatContext.runAgentTurn`.

---

## 5. Surfaces (one product)

| Surface | Route | Job |
| --- | --- | --- |
| Landing | `/` | Brand-first; CTAs match real console |
| Agent Console | `/chat` | Pick → run → pass → run next; sessions |
| Registry | `/registry` | Agents, skills, prompts, workflows |
| Jobs / Dashboard | `/jobs`, `/dashboard` | Lifecycle, artifacts, approval |
| Custom UIs | `/generate`, workflow-builder, … | Only when `has_custom_ui` |
| Docs / Settings / Automation | … | Accurate, consistent chrome |

**[r2] No transcript product. Decided, not deferred.** r1 said "delete the dual
Studio/Transcript product" in one section and proposed an optional transcript at
P2 in another. The workbench is the product; the transcript is deleted. If it is
ever wanted back, it is in git history. This removes the contradiction rather
than carrying it.

---

## Epic A — Agent Console (P0)

### UX

- Shell: sessions | compact config (model/engine/skill) | **[r3]** agent
  dropdown | input | output. *(r1 said "agent list": a 240px rail of every agent
  with two-line clamped descriptions, competing with the brief and output panels
  for the same viewport. It is a dropdown now — descriptions wrap to full width
  when open, and the returned width goes to the panels that needed it.)*
- Any agent runnable; friendly names (`displayAgentName`).
- Explicit **Pass** (not auto-pass on every agent click); optional extra
  instructions; no giant handoff blobs in the textarea.
- `nextAgents()` suggestions first in Pass UI.
- One session per chain; chain rail; session switch safe mid-run.
- Workflows = quiet **job** path, not agent turns.
- New chat when sidebar collapsed; mobile without clipped nav.

### Robustness

- `runAgentTurn`: run lock, abort ≠ false "no output", never wipe finished
  content with trailing empty commit, ignore results if session changed, keep
  handoff on failure.
- SSE: rAF coalesce; chunked yields; no update-depth crashes.
- Honest empty/error/stopped states (engine/model).
- Proxy `/api/v1`: JSON errors, never blank 500.
- **[r3] Derive UI state that selects among conditionally-rendered children;
  never correct it in an effect.** Learned the hard way: the output panel's tab
  was stored in state and repaired by a `useEffect`, so MUI still received one
  render with a `value` matching no child. Streaming made it constant rather
  than rare — a half-received JSON payload does not parse, so the document tabs
  unmount mid-stream and remount when the closing brace lands. Anything keyed to
  content that arrives incrementally has this shape; compute it at render time.

### Verification **[r2] — write the spec, don't eyeball it**

r1 said "verify in browser". That is unrepeatable, and an AI executor will claim
it without doing it. **Deliverable: `frontend/e2e/console-chain.spec.ts`**,
written once in this epic, run by every later slice:

```text
pick agent → enter sample → Run → assert output non-empty
→ Pass to next agent → Run → assert history ≥ 2, session id unchanged
→ assert no overlay/dialog left open
→ assert zero console errors
```

Add it to CI alongside the existing frontend build job.

---

## Epic B — Robustness (jobs / runner / ops) — no auth

Split into **verify** (already built, needs a regression test) and **build**.

### Verify only — do not rewrite

- Job state machine owns status; leases reclaim; approval gates respected.
- Schema validation/coercion: invalid output never silent success.
- Graceful shutdown returns in-flight work to the queue.

### Build

- Executors (local/docker/k8s): same contract; failures visible. Timeouts,
  cancel, partial artifacts, review retries **tested** — this is the real gap.
- Mock vs Copilot engine behaviour clear; no false empty chat turns.
- ~~**[r3] The mock engine does not honour its own agents' contracts.**~~ **[r5] fixed** — `_mock_contract_reply` now serves the runner's own canned documents, so a mock run through chat, the Lab and a job all produce the same payload for the same agent. Original finding:
  `test-designer` declares `output_schema: schemas/test-design.schema.json` and
  really returns JSON, but `_mock_test_designer_response` returns a Markdown
  table. So mock mode exercises a different output shape than production: the
  console's Structured view, `extractJson`, and every downstream consumer are
  untested under `ENGINE=mock`, which is the mode CI and first-run both use.
  Make the mock emit schema-valid JSON for agents that declare a schema.
- ~~**[r2] Artifact retention.**~~ **[r5] done.** `services/retention.py` prunes
  the workspaces of jobs that have been terminal for `ARTIFACT_RETENTION_DAYS`
  (30). It never touches queued, running or gate-waiting work whatever its age,
  and always keeps the newest `ARTIFACT_RETENTION_MIN_JOBS` (20) so a quiet
  platform does not delete the only examples it has. Runs hourly from the
  scheduler; set the days to 0 to disable. Artifacts are the evidence behind a
  result someone may have shipped, so the policy errs towards keeping.
- **[r2] Backup and restore.** Nothing covers Postgres or the artifact volume.
  At minimum: document the procedure and prove a restore once.
- **[r2] Deploy behaviour.** Rolling updates are the most frequent production
  event. Drain is implemented; add a test that a restart mid-job does not lose
  or duplicate work.

### ~~Known unknown — an intermittent test failure~~ **[r5] addressed**

One run reported `1 failed, 322 passed`; the name was never captured and 16
reruns all passed, so the specific failure was never identified.

Rather than hunt a ghost, the **class** of failure was removed: every test that
waited on a background worker with a wall-clock deadline now claims and executes
the job synchronously (`_drive` in `test_queue.py`, `_wait_for_terminal` in
`test_workflow_execution.py`). Those call exactly the code the worker loop calls,
so coverage is unchanged and no clock is involved. Six tests lost their
`worker` fixture; the suite went from ~20s to ~7s.

If a shuffled run ever fails again, it is now a real defect rather than a
timing artefact — treat it as one.

### **[r4] Lessons from three bugs found by using the product**

Each was invisible to reading the code and obvious within seconds of running it.
They are worth stating as rules, not anecdotes:

- **A counter that means two things will eventually be wrong for both.**
  `job.attempt` was the crash budget *and* the total-runs count, so a gated
  workflow spent its whole retry budget by succeeding, and reprocess was
  arithmetically impossible from the first release that added the cap.
- **A CSS rule can be valid and still inert.** The nav declared
  `position: sticky` and never stuck, because an ancestor's `overflowX: hidden`
  silently made that ancestor the containing block. Verify layout behaviour, not
  layout source.
- **Registry data is input, not configuration.** One agent declaring a YAML list
  of inputs — a legitimate fan-in stage — blanked the console, threw in the Lab
  and put a Python repr into a runner prompt. Normalise at the boundary; treat
  everything the hub returns as shape-unknown at the point of use.

### Trust boundary (not login)

- Agents cannot declare `shell`/`fetch`; path-safe IDs; workspace isolation.
- Input is data; schema gates on outputs.
- Don't commit secrets, `.env`, `jobs.db*` — see Epic E for the mechanical fix.

### Observability

- Structured logs for jobs/chat; clear job stage progress.
- `/api/v1/metrics` exists; add alert thresholds derived from §3.

---

## Epic C — Styling (UBS FIT)

Law: `frontend/src/theme/index.ts`.

**[r2] Rule 1 is currently unenforceable — fix this first or the audit is
fiction.** `globals.css` declares `@font-face` for
`/fonts/FrutigerforUBSWeb-{Lt,Md}.woff2`, but `frontend/public/fonts/` does not
exist. Every surface renders a fallback face today. Either ship the licensed
files or amend the law to name the accepted fallback stack. Auditing typography
before this is auditing a font you are not serving.

1. Frutiger Light/Medium only — hierarchy via size/colour, not weight.
2. **2px** corners — not pills, not soft-card radii.
3. Warm stone neutrals — no blue-grey chrome.
4. Brand red; workflow teal where established — **no purple, glow, heavy
   shadows**.
5. Cards only when they contain interaction.
6. Landing: brand-first, full-bleed hero, no first-viewport clutter.
7. Theme tokens over hex sprawl; Studio/OutputPreview match warm stone.

Verify: `/`, `/chat`, `/registry`, jobs — desktop + mobile, no hydration/theme
mismatch. Mechanical check for rule 7: no hex literals outside
`theme/index.ts` and `globals.css`.

---

## Epic D — Features (priority)

### P0

- Stabilize console workbench; align copy; fix stream/empty-output races;
  engine selector respected.

### P1

- **[r2] Golden dataset and release-over-release scoring — promoted from P2.**
  Every other item here protects against crashing. Nothing protects against the
  agents getting quietly *worse*. This platform's output is test cases people
  trust, and the damaging failure is a prompt edit that degrades quality with
  every gate still green — while Epic E actively encourages editing agents
  through the Registry, raising the rate of exactly that risk.
  `docs/architecture.md` already says to build this *before* editing skills
  freely. Minimum viable: 5–10 fixed requirements, stored expected scores, a
  command that runs them and diffs against the last release.
- Registry search/preview; jobs timeline + artifact clarity; structured handoff
  when JSON; Pass reasons; compact config.
- **[r4] Say when a reprocess is still running.** A reprocess is two agents —
  gap-closer, then test-evaluator. The gap-closer rewrites the suite and the
  results tab updates, so the job *looks* finished while the evaluator runs on
  for another minute. One run was cancelled by hand for exactly this reason.
  Cheapest fix: label the button "Cancel reprocess", name the running agent, and
  badge the results tab as provisional while the status is active. The real fix
  is representing the reprocess pass in the stepper — which today has no concept
  of it (`grep -i reprocess` finds nothing in `phases.ts` or `WorkflowStepper`).
- ~~**[r4] Decide fan-in semantics.**~~ **[r5] partly done** — a stage now fails
  fast when *none* of its declared inputs exist, and is told which are missing
  when only some do. Ordering already worked via `depends_on`. Still open: An agent may now declare several inputs, but
  the generic runner has no join: it runs the stage once with both paths named
  in the prompt and does not wait for, or check, either producer. That works by
  luck. Before shipping multi-branch workflows, decide whether a stage blocks on
  all its declared inputs and what happens when one is missing.

### P2

- Automation polish; custom UIs same chrome.
- **Do not** add auth/OIDC/token epics.

---

## Epic E — Hygiene

### ~~Do this first~~ — **[r3] done**

Applied. `.gitignore` now covers `frontend/.ubs-verify/`, `/.next/`,
`/package-lock.json`, `*.db-shm` and `*.db-wal`, with a comment on the last pair
saying why (`*.db` does not match the SQLite WAL sidecars) and on the lockfile
saying why `frontend/package-lock.json` is deliberately *not* ignored.

Verified: `git status --porcelain -uall` now lists source files only. Previously
it offered 25 verify screenshots, both WAL sidecars, a stray root lockfile and a
build trace to any `git add .`.

### **[r2] Lockfile correction — r1 was wrong and would break CI**

`frontend/package-lock.json` is **tracked and stays tracked**: CI runs `npm ci`
against it and keys its cache on it. Removing or ignoring it breaks the build
and un-pins production installs. Only the **stray root** `package-lock.json` is
junk.

### **[r2] Dead code — the target moved**

r1 said "remove unmounted legacy chat UI", meaning `AgentStudio`. That is now
mounted. The orphans today are:

- `frontend/src/components/chat/ChatInput.tsx` — 277 lines, zero importers
- `frontend/src/components/chat/ChatMessage.tsx` — 191 lines, only its *type* is
  imported (from `lib/chat-api`), not the component

Delete both, along with anything they alone pulled in.

**[r3] Adding the dead-code check is a real task, not a checkbox.** There is no
ESLint config in `frontend/` at all — `npm run lint` runs `next lint`, which
drops into an interactive "how would you like to configure ESLint?" prompt and
hangs a non-interactive shell. CI never runs it (the frontend job builds only).
So "add `knip` or `ts-prune` to CI" means: install and configure a tool, decide
its ignore list, and add a CI step — half a day, not a line. Budget it or drop
the DoD row honestly; do not leave a check nobody can run.

### Rest

- Tests: backend green; add console logic tests + the Epic A smoke spec.
- README: local run with open mode + `ENGINE=mock`; no "enable auth for prod"
  checklist — document network isolation instead.

---

## Definition of Done **[r2] — every row has a check that can fail**

| Outcome | Mechanical check |
| --- | --- |
| Console chain works on one session; no false empty output | `console-chain.spec.ts` green in CI |
| No dead UI | `knip` / `ts-prune` clean in CI — **[r3]** neither is installed yet; see Epic E |
| Repo hygiene holds | `git status --porcelain -uall` shows nothing stageable but source — **[r3] passing** |
| Auth still disabled, none added | no `/api/auth/*` route; `AUTH_MODE=disabled`; `pytest tests/test_security.py` |
| Jobs + chat failures actionable | no blank 500s: every error path returns JSON with `detail` + `request_id` |
| Backend not regressed | `pytest tests/` ≥ 335 passing **[r5]**, and green under `pytest-randomly` |
| Frontend not regressed | `tsc --noEmit` clean, `next build` clean |
| Styling law holds | no hex literals outside `theme/index.ts` + `globals.css`; fonts resolve (no 404s in dev log) |
| Quality does not drift | golden-set run diffs within tolerance of last release |
| Executors honest | timeout / cancel / partial-artifact tests present and green |

---

## Execute **[r2] — reordered**

**E-hygiene (minutes) → B critical paths → A → C on touched UI → D P1 → E rest.**

r1 ran `A → B → C → D → E`, which put a UX epic ahead of every reliability item
in a brief titled "production hardening". Hygiene moves first because it is five
lines and prevents accidents from here on.

Each slice: user outcome → implement → tests → run the smoke spec → summarize
risks.

### Working agreement

- Never run a bare `npm run build` in `frontend/` while a dev server is live —
  they share `.next/`, and the production build orphans the running server's
  chunks (`Cannot find module './447.js'`). `next.config.ts` already solves
  this: it reads `NEXT_DIST_DIR`. Use

  ```bash
  NEXT_DIST_DIR=.next-verify npm run build   # then rm -rf frontend/.next-verify
  ```

  There is no `--distDir` CLI flag in Next 15; it is config-only, which is why
  the env var exists.
- Backend and frontend both green before a slice is called done.
