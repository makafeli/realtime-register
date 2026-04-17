# realtime-register

[![npm](https://img.shields.io/badge/npm-realtime--register-cb3837?logo=npm)](https://www.npmjs.com/package/realtime-register)
[![licence](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520.11-44883e?logo=node.js&logoColor=white)](https://nodejs.org)
[![operations](https://img.shields.io/badge/operations-109%2F109%20verified-2ea44f)](docs/fidelity.md)
[![categories](https://img.shields.io/badge/categories-16-4c8cbf)](#spec-layout)

A hand-curated, fidelity-verified specification and CLI for the
[Realtime Register](https://www.realtimeregister.com) REST API v2. Every
non-SiteLock endpoint — **109 operations across 16 categories** — is described
in machine-readable YAML, reconciled field-by-field against the live HTML
documentation at [`dm.realtimeregister.com/docs/api`](https://dm.realtimeregister.com/docs/api).

One package, two audiences:

- **AI agents** load `SKILL.md` + `references/*.md` as structured context and
  validate outgoing requests through `rtr validate`.
- **Human developers** use `rtr` at the terminal for schema-validated request
  construction, operation lookup, and doc-link auditing.

---

## Highlights

- **100 % fidelity** — all 109 operations carry `verified: docs` (path, URL
  params, query params, and request-body fields reconciled against the live
  HTML). See [`docs/fidelity.md`](docs/fidelity.md).
- **Runtime validation** — JSON Schemas derived from the YAML, evaluated by
  `ajv` with format checks for `email`, `uri`, `date`, `date-time`, `ipv4`,
  `ipv6`.
- **Agent-first docs** — `SKILL.md` + `references/<category>.md` are the only
  files an LLM needs to load; they are terse, structured, and stable.
- **Zero-surprise CLI** — six subcommands, no config files, no env vars, no
  network access except `doctor` and `scrape`.
- **CamelCase everywhere** — matches the official TypeScript SDK and the
  on-the-wire protocol.

---

## Quick start

```bash
npm install -g realtime-register
rtr --help
```

Or run without installing:

```bash
npx realtime-register list --category domains
```

### Describe an operation

```bash
rtr describe registerDomain
```

### Validate a request body before sending

```bash
cat > /tmp/register.json <<'JSON'
{
  "registrant": "H1234567",
  "period": 12,
  "ns": ["ns1.example.com", "ns2.example.com"],
  "privacyProtect": true
}
JSON

rtr validate registerDomain --body /tmp/register.json
# → exits 0 if the body matches the schema, 1 otherwise
```

### Audit every documentation link

```bash
rtr doctor
# OK  200 registerDomain    https://dm.realtimeregister.com/docs/api/domains/create
# OK  200 getDomain         https://dm.realtimeregister.com/docs/api/domains/get
# … 109 lines total, non-200s exit non-zero.
```

---

## CLI at a glance

| Command                                         | Purpose                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `rtr list [--category <name>]`                  | List all operations or one category.                                             |
| `rtr describe <operationId>`                    | Full contract for one operation: path, params, body, errors, gotchas, examples.  |
| `rtr validate <operationId> --body <file.json>` | Validate a request body, query, or path params against the schema.               |
| `rtr generate [--category <name>]`              | Render `references/<category>.md` from the YAML.                                 |
| `rtr scrape <operationId>`                      | Fetch the live HTML doc for an operation; print a spec skeleton.                 |
| `rtr doctor [--category <name>]`                | Verify every `docUrl` returns HTTP 200.                                          |

Full flag reference in [`docs/cli.md`](docs/cli.md).

---

## Spec layout

The source of truth is `assets/spec/`:

```text
assets/spec/
├── _shared.yaml        # enums and reusable nested types
├── domains.yaml        # 13 operations (11 customer + 2 gateway)
├── hosts.yaml          #  5 operations
├── contacts.yaml       # 11 operations
├── dnsZones.yaml       #  9 operations
├── dnsTemplates.yaml   #  5 operations
├── validation.yaml     #  2 operations
├── ssl.yaml            # 17 operations
├── sslAcme.yaml        #  7 operations
├── notifications.yaml  #  5 operations
├── processes.yaml      #  5 operations
├── customers.yaml      #  2 operations
├── brands.yaml         # 10 operations (CRUD + templates + locales)
├── financial.yaml      #  4 operations
├── tlds.yaml           #  2 operations
├── providers.yaml      #  7 operations (incl. gateway-only registry accounts)
└── misc.yaml           #  5 operations (IsProxy + 4 ADAC WebSocket actions)
```

Each operation carries `operationId`, `method`, `path`, `docUrl`, `async`,
`authScope`, `deprecated`, `verified`, `pathParams`, `queryParams`,
`requestBody.fields`, `responses`, `errors`, `gotchas`, and `examples`. Full
schema in [`docs/spec-format.md`](docs/spec-format.md).

---

## Using the skill from an AI agent

The `SKILL.md` file at the repo root is the canonical entry point. Load it
into your agent's system context along with the relevant
`references/<category>.md` file(s). A typical flow:

1. Agent receives user request ("renew example.com for two years").
2. Agent loads `SKILL.md` → learns the hard rules (camelCase, `period` in
   months, async polling, billable acknowledgment).
3. Agent loads `references/domains.md` → finds the `renewDomain` entry.
4. Agent builds the payload and calls `rtr validate renewDomain --body …`
   before issuing the HTTP request.
5. On HTTP 202, agent polls `/v2/processes/{processId}` via the `processes`
   category.

End-to-end integration notes, a programmatic validation snippet, and the
billable-acknowledgment / async-mutation patterns are documented in
[`docs/agent-integration.md`](docs/agent-integration.md).

---

## Fidelity markers

Every operation declares a `verified` marker:

- **`docs`** — path, URL parameters, query parameters, and request-content
  fields reconciled against the live HTML.
- **`sdk`** — derived from the public TypeScript SDK and the navigation slug
  only; no HTML-level reconciliation yet.

**As of v0.1.0, all 109 operations carry `verified: docs`.** Promotion
workflow, drift policy, and enforcement tooling are documented in
[`docs/fidelity.md`](docs/fidelity.md).

---

## Documentation index

| File                                                          | Audience    | Purpose                                               |
| ------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| [`SKILL.md`](SKILL.md)                                        | AI agents   | Skill card with activation rules and hard invariants  |
| [`references/<category>.md`](references/)                     | AI + human  | Per-category operation reference (generated)          |
| [`docs/agent-integration.md`](docs/agent-integration.md)      | Agent devs  | How to load the skill, validate payloads, handle async |
| [`docs/cli.md`](docs/cli.md)                                  | Humans      | Full CLI flag and exit-code reference                 |
| [`docs/spec-format.md`](docs/spec-format.md)                  | Contributors| YAML schema for every field in `assets/spec/`         |
| [`docs/fidelity.md`](docs/fidelity.md)                        | Maintainers | Reconciliation policy and drift detection             |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                          | Contributors| How to land a PR                                      |
| [`HANDOVER.md`](HANDOVER.md)                                  | Maintainers | End-to-end project memory and onboarding guide        |
| [`CHANGELOG.md`](CHANGELOG.md)                                | Everyone    | Release history                                       |

---

## Requirements

- Node.js **20.11** or newer.
- No runtime Realtime Register account needed for the CLI — schema validation
  is local. You only need credentials to actually call `api.yoursrs.com`.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). In short: never edit
`references/*.md` directly (they are generated), keep field names camelCase,
and run `rtr doctor` + `node scripts/audit-refs.mjs` before opening a PR.

---

## Licence

[MIT](LICENSE). Not affiliated with Realtime Register B.V.; this project
merely consumes their public documentation.
