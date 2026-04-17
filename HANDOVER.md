# Handover — `realtime-register`

Last updated: **2026-04-17** · Savepoint: **v0.1.0** · Repo:
<https://github.com/makafeli/realtime-register>

This document is the canonical technical memory for the project. It is written
for a developer taking over from cold — it assumes no prior conversation
context. After reading it end-to-end you should be able to clone the repo,
build it, ship a spec change, and understand why every architectural choice
was made.

If you are an AI agent looking to *consume* the skill, read `SKILL.md` first.
This file is for people (or agents) who *maintain* the skill.

---

## 1. Project genesis & status

### What this project is

A hand-curated, fidelity-verified specification and CLI for the
[Realtime Register](https://www.realtimeregister.com) REST API v2. It exists
because the upstream HTML docs at
<https://dm.realtimeregister.com/docs/api> are authoritative but not
machine-readable, and the official TypeScript SDK is a client library, not a
contract. This project bridges that gap with a YAML spec that is:

- Small enough to hand-audit.
- Rigorous enough to drive runtime JSON-Schema validation.
- Structured enough for AI agents to retrieve per-operation.

### The "100 % Verified" milestone

As of v0.1.0, **all 109 non-SiteLock operations across 16 categories carry
`verified: docs`**. Concretely this means, for every operation:

- `path` matches the page's rendered endpoint template.
- `pathParams` names match the page's `URL fields` table.
- `queryParams` names and types match the `Request parameters` table.
- `requestBody.fields` names, types, required flags, and enums match the
  `Request content` table.
- `docUrl` resolves HTTP 200 (`rtr doctor`).

Counts by category (sum = 109):

| Category        | Ops | Notes                                                 |
| --------------- | --- | ----------------------------------------------------- |
| `domains`       | 13  | 11 customer + 2 gateway                               |
| `hosts`         | 5   | Host (nameserver) CRUD                                |
| `contacts`      | 11  | Contact CRUD + validation handlers                    |
| `dnsZones`      | 9   | `{zoneId}`-scoped; `/stats`; process `ack-ds-update`  |
| `dnsTemplates`  | 5   | Customer-scoped: `/v2/customers/{customer}/dnstemplates/{template}` |
| `validation`    | 2   | `/v2/validation/categories/{categoryName}`            |
| `ssl`           | 17  | Certificate lifecycle + product catalog               |
| `sslAcme`       | 7   | ACME subscription lifecycle                           |
| `notifications` | 5   | Subscription management                               |
| `processes`     | 5   | Async process polling                                 |
| `customers`     | 2   | Customer info                                         |
| `brands`        | 10  | Brand CRUD + mail templates + locales                 |
| `financial`     | 4   | Financial summaries                                   |
| `tlds`          | 2   | TLD metadata                                          |
| `providers`     | 7   | Providers + gateway-only registry accounts            |
| `misc`          | 5   | IsProxy + 4 ADAC WebSocket actions                    |

### How we got here (abridged history)

1. **Bootstrapped from SDK** — initial spec was scaffolded from the public
   TypeScript SDK; every op landed with `verified: sdk`.
2. **Slug reconciliation** — all 109 `docUrl` slugs cross-checked against the
   live nav, fixing a handful of mis-slugged ACME / validation / process
   entries.
3. **Field-level promotion** — each category was re-scraped via
   `scripts/extract-fields.mjs`, URL fields / request params / request
   content tables diffed against the YAML. Material corrections include:
   - `dnsZones`: `{name}` → `{zoneId}` (integer); `/statistics` → `/stats`;
     `ack-ds-update` moved to `/v2/processes/{processId}/ack-ds-update`.
   - `dnsTemplates`: paths rescoped to `/v2/customers/{customer}/dnstemplates/{template}`;
     SOA fields (`hostMaster`, `refresh`, `retry`, `expire`, `ttl`) marked
     required; non-existent `dnssec` field dropped.
   - `brands`: `createBrand` picked up `hideOptionalTerms`, `contactUrl`;
     required flags corrected on organisation/address fields;
     `privacyContact`/`abuseContact` switched from email format to contact
     handles; non-existent `name`/`mailServer` removed.
   - `validation`: path corrected to
     `/v2/validation/categories/{categoryName}`; added `fields` query param.
4. **Doctor pass** — `rtr doctor` across all 109 slugs, every one HTTP 200.
5. **Docs build-out** — README, SKILL, docs/, CHANGELOG, CONTRIBUTING.
6. **Public release** — repo created at `makafeli/realtime-register` and
   pushed as `main` @ `d23771d`.

### Out of scope (intentionally)

- **SiteLock** — separate product, different auth, different contract.
  Excluded from the spec and all tooling.
- Any endpoint flagged **Internal** in the HTML docs.
- Runtime HTTP client code. This project generates schemas and docs; actual
  API calls are the consumer's responsibility.

---

## 2. Core architecture — Single Source of Truth

The entire project radiates out of `assets/spec/`. Every other artefact is
derived; nothing else should be hand-edited.

```
                          assets/spec/
                          ├── _shared.yaml   (enums + reusable types)
                          └── *.yaml         (16 category files)
                                │
                                │   load + parse (src/lib/spec.ts)
                                ▼
                       in-memory Spec model
                                │
         ┌──────────────────────┼─────────────────────────────┐
         ▼                      ▼                             ▼
  src/lib/schema.ts      src/cli/commands/generate.ts   src/cli/commands/
  (JSON Schema via              │                        list/describe/
   ajv + ajv-formats)           │                        scrape/doctor
         │                      ▼                             │
         ▼               references/*.md                      ▼
  rtr validate           (generated MD,                 terminal output
                          commit in same PR
                          as YAML edits)
```

Key invariants enforced by this design:

- **No duplicate source of truth.** `references/*.md` are always regenerated
  from YAML; never hand-edit them.
- **Schemas are derived, not written.** The ajv schema for any operation is
  a pure function of the YAML entry.
- **CamelCase is structural.** Field names across the spec, schemas, and
  generated docs are camelCase; any deviation is a bug.
- **Shared types live in `_shared.yaml`.** Cross-category references (via
  `ref:`) resolve against that file; `scripts/audit-refs.mjs` catches any
  dangling reference.

### Source tree orientation

```
realtime-register/
├── SKILL.md                  # agent entry point (activation + hard rules)
├── README.md                 # human entry point
├── HANDOVER.md               # you are here
├── CHANGELOG.md              # Keep-a-Changelog
├── CONTRIBUTING.md           # PR workflow
├── LICENSE                   # MIT
├── package.json              # Node 20.11+, "type": "module", bin=rtr
├── tsconfig.json             # emits into dist/
├── bin/rtr.js                # shim: resolves dist/ in prod, src/ in dev
├── src/
│   ├── cli/
│   │   ├── index.ts          # commander wiring
│   │   └── commands/{list,describe,validate,generate,scrape,doctor}.ts
│   └── lib/
│       ├── spec.ts           # YAML loader + Spec model
│       ├── schema.ts         # YAML → JSON Schema (ajv-compatible)
│       ├── scraper.ts        # HTML fetch + cheerio parse
│       └── types.ts          # TS types for Spec / Operation
├── assets/spec/              # source of truth (§2)
├── references/               # generated per-category MD (do not hand-edit)
├── scripts/                  # maintenance utilities (§5)
├── docs/                     # long-form docs (agent / CLI / spec / fidelity)
└── dist/                     # tsc output (gitignored)
```

---

## 3. Execution & development

### 3.1 Local setup

Requirements: **Node.js 20.11+**, npm, git.

```bash
git clone https://github.com/makafeli/realtime-register.git
cd realtime-register
npm install
npm run build     # tsc → dist/
node bin/rtr.js --help
```

Available npm scripts:

| Script                   | Runs                                    |
| ------------------------ | --------------------------------------- |
| `npm run build`          | `tsc -p tsconfig.json`                  |
| `npm run dev`            | `tsc --watch`                           |
| `npm run lint`           | `tsc --noEmit`                          |
| `npm run audit`          | `node scripts/audit-refs.mjs`           |
| `npm run doctor`         | `node bin/rtr.js doctor`                |
| `npm run generate`       | `node bin/rtr.js generate`              |
| `npm run prepublishOnly` | `npm run build` (guard for `npm publish`) |

### 3.2 CLI reference with examples

All six commands operate on `assets/spec/`. Only `scrape` and `doctor`
access the network (HTTPS to `dm.realtimeregister.com`).

#### `rtr list`

```bash
$ rtr list --category domains
domains    GET   /v2/domains                          listDomains      docs
domains    GET   /v2/domains/{domainName}             getDomain        docs
domains    POST  /v2/domains/{domainName}             registerDomain   docs
...
```

Columns: category · method · path · operationId · `verified` marker.

#### `rtr describe <operationId>`

```bash
$ rtr describe registerDomain
registerDomain  POST /v2/domains/{domainName}   async
  docUrl: https://dm.realtimeregister.com/docs/api/domains/create
  authScope: customer
  path params:
    - domainName (string, required)
  request body:
    - registrant       string   required
    - period           integer  required   (months; 12 = one year)
    - ns               string[]
    - privacyProtect   boolean
    - billables        Billable[]
  errors: InvalidParameter, DomainAlreadyRegistered,
          BillableAcknowledgmentNeeded
  gotchas:
    - period is in months (12 = one year), never years
    - first call may 400 with BillableAcknowledgmentNeeded;
      resubmit with billables[]
```

Authoritative pre-flight reference before writing client code.

#### `rtr validate <operationId>`

```bash
$ cat > /tmp/register.json <<'JSON'
{ "registrant": "H1234567", "period": 12, "ns": ["ns1.example.com"] }
JSON
$ rtr validate registerDomain --body /tmp/register.json
OK
$ echo $?
0
```

Flags: `--body <file>`, `--query <file>`, `--path-params <file>`
(combinable). Exit codes: `0` pass · `1` schema violation · `2` unknown op
or missing file. Validation uses `ajv` + `ajv-formats` (`email`, `uri`,
`date`, `date-time`, `ipv4`, `ipv6`).

#### `rtr generate`

```bash
$ rtr generate                    # all 16 files
$ rtr generate --category ssl     # one
$ rtr generate --out build/ref    # alternate destination
```

Commit the regenerated `references/*.md` in the same PR as the YAML change
that caused the regen.


#### `rtr scrape <operationId>`

Fetch the live HTML doc and print a YAML-shaped skeleton derived from the
page's `URL fields`, `Request parameters`, and `Request content` tables.

```bash
$ rtr scrape registerDomain
# URL fields:
#   - domainName (string, required)
# Request parameters: (none)
# Request content:
#   - registrant   string   required
#   - period       integer  required
#   ...
```

Nothing is written to disk. Diff the output against the corresponding YAML
entry when reconciling upstream drift.

#### `rtr doctor`

```bash
$ rtr doctor
OK  200 listDomains        https://dm.realtimeregister.com/docs/api/domains/list
OK  200 getDomain          https://dm.realtimeregister.com/docs/api/domains/get
...  (109 lines total)
```

Exits non-zero on the first non-200. Use `--category <name>` for a subset.
CI should run this on every push.

### 3.3 Typical day-to-day workflow

**Spec change** (e.g. upstream adds a new field):

```bash
node bin/rtr.js scrape <operationId>         # 1. pull fresh live shape
$EDITOR assets/spec/<category>.yaml          # 2. reconcile YAML
npm run build                                 # 3. ensure schema still builds
node scripts/audit-refs.mjs                   # 4. counts/slugs sanity
node bin/rtr.js doctor                        # 5. all 200s
node bin/rtr.js generate                      # 6. regen references/
git add assets/spec references CHANGELOG.md   # 7. commit both
```

**CLI change** (e.g. new `--format json` on `list`):

```bash
$EDITOR src/cli/commands/list.ts
npm run build
node bin/rtr.js list --format json            # manual smoke test
$EDITOR CHANGELOG.md                          # add under [Unreleased]
```

---

## 4. Agent skill logic

The project is designed to be loaded as an **AI Agent Skill**. The
skill-shaped surface is small on purpose.

### `SKILL.md` — the entry point

`SKILL.md` has YAML front-matter containing `name:` and `description:`,
followed by markdown sections describing *when* the skill should activate,
the workflow steps, and a set of **hard rules**. It is intentionally short
(~60 lines) so it can live in an agent's system context permanently.

### Retrieval strategy (recommended)

1. Always include `SKILL.md` in system context.
2. Index `references/<category>.md` by `operationId`; load one file when a
   matching operation is needed.
3. Before emitting any HTTP call, validate the payload via
   `rtr validate <operationId> --body …` (exit `0` = safe to send).

### Hard rules (non-negotiable)

These are surfaced in `SKILL.md` and must be propagated to any downstream
agent verbatim. Violating them produces requests the API rejects:

- **CamelCase wire format.** Never `snake_case`, never `kebab-case`.
- **`period` is always in months.** 12 = one year. Never pass years.
- **Contact roles are `ADMIN`, `BILLING`, `TECH` only.**
- **DNSSEC uses `keyData` XOR `dsData`.** Never both.
- **`renewDomain` requires the current `expiryDate`.** Never omit.
- **Registry-account endpoints** (`authScope: gateway`) need gateway
  credentials distinct from customer credentials — never mix.
- **Never invent enum values.** Defer to `_shared.yaml` or `rtr describe`.

### Two API patterns every agent must implement

**Async mutation pattern.** Most mutating endpoints return HTTP 202 with
`{ processId }`. The agent must poll `GET /v2/processes/{processId}` every
2–5 s until `status === "COMPLETED"` (or `FAILED`). Operations requiring
this carry `async: true` in the YAML.

**Billable acknowledgment pattern.** Billable mutations (register, renew,
transfer, restore, SSL issuance …) return HTTP 400 with
`BillableAcknowledgmentNeededException` on the first call. The response
contains a `billables: [{product, action, quantity}]` array. Re-submit the
same request body with that array copied verbatim at the top level; the
second call succeeds. The `Billable` shape lives in `_shared.yaml`.

### Fidelity markers (recap)

- `verified: docs` — path, params, fields reconciled with live HTML.
- `verified: sdk` — only SDK-derived; not yet diffed against HTML.

As of v0.1.0, all 109 ops are `docs`. New ops added after v0.1.0 should
land as `sdk` and be promoted before the next minor release.

---

## 5. Tooling & scripts

The `scripts/` directory holds maintenance utilities that are not part of
the shipped CLI. All are plain `.mjs` and need no TypeScript build.

### `scripts/audit-refs.mjs`

Static sanity check of the full spec. Run before every release.

```bash
$ node scripts/audit-refs.mjs
=== RTR spec audit ===
categories: 16
operations: 109
  brands           10
  contacts         11
  ...
problems: 0
```

Checks performed:

- Category count (expect 16).
- Total operation count (expect 109).
- Per-category op counts against the known-good table.
- `operationId` uniqueness across all categories.
- Every `ref:` resolves to an enum or type in `_shared.yaml`.
- Every `docUrl` starts with a valid slug prefix.

Exit 0 on clean audit, non-zero on any problem.

### `scripts/extract-fields.mjs`

Cheerio-backed scraper. Given a local HTML cache of a docs page, prints its
`URL fields`, `Request parameters`, and `Request content` tables in a
diff-friendly form. Used during the v0.0.x → v0.1.0 reconciliation push;
kept around for bulk promotion work.

```bash
$ curl -so /tmp/brands-create.html \
    https://dm.realtimeregister.com/docs/api/brands/create
$ node scripts/extract-fields.mjs /tmp/brands-create.html
```

Prefer `rtr scrape` for one-offs; use this script when you need to diff
dozens of cached pages without re-hitting the network.

### `scripts/reconcile-sdk.mjs`

Legacy helper that cross-referenced the initial SDK-derived spec against
the live nav to catch mis-slugged `docUrl`s. Not needed for day-to-day
work, but retained for archaeology if a future bulk re-seed is needed.

---

## 6. Future roadmap

The v0.1.0 savepoint is feature-complete for the "fidelity promotion" goal.
What follows is the backlog the next developer should pick up, in roughly
descending priority.

### Short term (pre-v0.2.0)

1. **GitHub Actions CI.** Add `.github/workflows/ci.yml` running on push and
   PR:
   - `npm ci`
   - `npm run build`
   - `npm run lint`
   - `npm run audit`
   - `npm run doctor` (gated to main/tags to avoid hammering upstream)
   - Matrix over Node 20 / 22.
2. **Tag + GitHub Release for v0.1.0.**
   ```bash
   git tag -a v0.1.0 -m "v0.1.0 — 100% verified: docs"
   git push origin v0.1.0
   gh release create v0.1.0 -F CHANGELOG.md
   ```
3. **Publish to npm.** `npm publish --access public` against the
   `realtime-register` package name. Requires an npm login; the
   `prepublishOnly` script will rebuild `dist/` automatically.

### Medium term (v0.2.0)

4. **Automated drift detection.** Scheduled (weekly) GitHub Actions job
   that:
   - Runs `rtr scrape` across all 109 operations.
   - Diffs the skeleton against the YAML via a to-be-written
     `scripts/diff-live.mjs`.
   - Opens an issue with label `fidelity-drift` listing any differences.
5. **Unit tests.** No test suite exists yet. Seed with:
   - `src/lib/spec.ts` loader tests (malformed YAML, missing fields).
   - `src/lib/schema.ts` — snapshot test that
     `buildSchema(spec, "registerDomain")` matches a fixture.
   - CLI smoke tests via `execa` calling `bin/rtr.js` in a temp dir.
   - Suggested: `vitest` with `--coverage`.
6. **`rtr diff` subcommand.** Wrap `scrape` + structured diff into a first-
   class command so `sdk` → `docs` promotion becomes one step.
7. **Response-body schemas.** Currently `responses` only carries a
   `description`. Add an optional `fields` list and wire into `rtr validate
   --response`.

### Long term (v1.0.0)

8. **OpenAPI export.** `rtr export --format openapi3` emitting a single
   `openapi.json` covering all 109 ops. Enables third-party codegen
   (Prisma, Kiota, openapi-typescript-codegen).
9. **Language-agnostic skill bundle.** Publish an MCP-compatible server so
   non-Node agents can call `list`/`describe`/`validate` over stdio.
10. **SiteLock integration** (scope change). Would require onboarding the
    separate SiteLock API contract; currently out of scope, tracked as a
    standing non-goal.

### Known gaps / tech debt

- `src/lib/schema.ts` does not yet model cross-field invariants (e.g.
  DNSSEC `keyData` XOR `dsData`). These live in `gotchas` strings and are
  not enforced programmatically.
- `rtr describe` prints a human-shaped view; there is no JSON output mode
  for tooling consumption.
- `rtr doctor` is sequential; parallelising with a small worker pool would
  cut wall time from ~20 s to ~3 s but risks upstream rate-limiting.
- `scripts/extract-fields.mjs` expects cached HTML; it has no caching
  layer of its own. A `--cache-dir` flag is a low-effort improvement.

---

## Appendix A — repository metadata

| Attribute        | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Repo             | <https://github.com/makafeli/realtime-register>          |
| Default branch   | `main`                                                   |
| Current HEAD     | `d23771d` — *Initial release: realtime-register v0.1.0* |
| Licence          | MIT                                                      |
| Package name     | `realtime-register`                                      |
| Package version  | `0.1.0` (unpublished to npm as of handover)              |
| Runtime          | Node.js 20.11+                                           |
| Author           | Yasin Boelhouwer <yasin@enginebit.com>                   |
| Upstream docs    | <https://dm.realtimeregister.com/docs/api>               |
| API base URL     | `https://api.yoursrs.com`                                |

## Appendix B — where to look next

| If you need to …                                  | Read                                          |
| -------------------------------------------------- | --------------------------------------------- |
| Activate the skill in an agent                     | `SKILL.md`                                    |
| Understand the CLI surface                         | `docs/cli.md`                                 |
| Edit a spec entry                                  | `docs/spec-format.md`                         |
| Understand the `docs`/`sdk` markers and drift policy | `docs/fidelity.md`                          |
| Integrate from agent code                          | `docs/agent-integration.md`                   |
| Land a PR                                          | `CONTRIBUTING.md`                             |
| See what changed between versions                  | `CHANGELOG.md`                                |
| Browse operations by category                      | `references/<category>.md`                    |
| Extend the CLI                                     | `src/cli/commands/<command>.ts`               |
| Change schema derivation                           | `src/lib/schema.ts`                           |

## Appendix C — "it's broken" flowchart

1. **`npm install` fails** → check Node version (`node -v` must be ≥ 20.11).
2. **`npm run build` fails** → run `npm run lint` to isolate type errors;
   look at the most recent edits under `src/`.
3. **`rtr doctor` reports non-200** → upstream slug changed. Find the op
   in the live nav, update `docUrl` in the YAML, commit, re-run.
4. **`audit-refs.mjs` reports `problems: N`** → output names the problem.
   Common causes: duplicate `operationId`, unresolved `ref:`, mismatched
   category count.
5. **`rtr validate` fails unexpectedly** → the schema is derived from YAML;
   confirm the field actually exists on the op with `rtr describe`, and
   verify `required:` flags in the YAML match reality.
6. **Nothing makes sense** → `git log --oneline` is small; start from
   `d23771d` and read forward.

---

*End of handover. Questions, open issues, and drift reports go to
<https://github.com/makafeli/realtime-register/issues>.*
