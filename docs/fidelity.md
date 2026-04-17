# Fidelity policy

The purpose of this spec is to stay bit-for-bit faithful to the live Realtime
Register API documentation at `dm.realtimeregister.com/docs/api`. This
document explains how that fidelity is maintained and verified.

## The two markers

Every operation in `assets/spec/` carries a `verified` field with one of two
values:

### `verified: docs`

Path, URL parameters, query parameters, and request-content fields have been
reconciled against the live HTML. Specifically:

- `path` matches the page's rendered endpoint template.
- `pathParams` names match the `URL fields` table.
- `queryParams` names and types match the `Request parameters` table.
- `requestBody.fields` names, types, required flags, and enums match the
  `Request content` table.

As of this release **all 109 operations carry `verified: docs`**.

### `verified: sdk`

Structure is derived from the public TypeScript SDK and the navigation slug,
but no HTML reconciliation has been performed on field-level data yet.
Operations in this state should be considered provisional for wire-level use.

## Invariants

The following properties hold for every operation regardless of verification
state:

- `operationId` is camelCase and globally unique.
- `path` starts with `/v2/`.
- `docUrl` resolves with HTTP 200 (enforced by `rtr doctor`).
- Field names are camelCase (enforced manually; see the camelCase rule in
  `SKILL.md`).
- Enum values match `_shared.yaml` where a reference is used.

## Promotion workflow (`sdk` → `docs`)

```
┌──────────────┐   rtr scrape    ┌──────────────┐   manual edit   ┌──────────────┐
│ verified:sdk │ ──────────────▶ │  HTML diff   │ ──────────────▶ │verified:docs │
└──────────────┘                 └──────────────┘                 └──────────────┘
```

Concretely:

1. `rtr scrape <operationId>` fetches the page and prints the URL fields,
   request parameters, and request content as a YAML-ready skeleton.
2. Diff against the existing entry in `assets/spec/<category>.yaml`.
3. Apply corrections: add missing fields, fix required flags, correct enum
   values, rename path params, adjust path templates.
4. Flip `verified: sdk` to `verified: docs`.
5. Run `node scripts/audit-refs.mjs` to confirm counts/slugs still balance.
6. Run `rtr generate` to regenerate the Markdown reference.

For bulk reconciliation, `scripts/extract-fields.mjs` can be pointed at a
local cache of HTML files (see its header comment).

## Enforcement tooling

| Tool                             | Checks                                          |
| -------------------------------- | ----------------------------------------------- |
| `rtr doctor`                     | Every `docUrl` returns HTTP 200                 |
| `node scripts/audit-refs.mjs`    | Category/operation counts, slug uniqueness, `_shared` refs resolvable |
| `scripts/extract-fields.mjs`     | Pulls URL fields / request params / request content from cached HTML |
| `tsc --noEmit`                   | Type safety of the schema-derivation code       |

All four are cheap to run locally; CI should invoke `rtr doctor` and
`audit-refs.mjs` on every push.

## Known out-of-scope endpoints

The following are **intentionally excluded** from the spec:

- **SiteLock** — separate product, different auth, different contract.
- Any endpoint flagged `Internal` in the HTML docs.

Gateway-only registry-account endpoints (`authScope: gateway`) are included
because they share customer credentials at the transport layer but require
a different API key at the application layer. They are clearly marked and
should never be invoked with customer-scope credentials.

## Drift policy

Upstream docs can change silently. The project mitigates drift by:

1. `rtr doctor` on every release (catches slug renames and deletions).
2. Quarterly `rtr scrape` across all 109 operations, diff-checked against
   the YAML (catches field additions/removals).
3. Community drift reports welcomed via GitHub issues with the
   `fidelity-drift` label.

When drift is detected, the reconciliation workflow above applies.
