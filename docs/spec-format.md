# Spec format

Every category YAML in `assets/spec/` conforms to the structure documented
here. The format is intentionally hand-friendly — it is human-authored, not
generated from a schema, and prioritises readability over closed-world rigor.

## File layout

```yaml
category: domains          # short identifier, matches filename
label: Domains             # human label for generated headings
description: |             # multi-line, used as the `references/<cat>.md` intro
  Register, update, renew, ...

operations:
  - operationId: registerDomain
    verified: docs           # docs | sdk
    method: POST             # GET | POST | PUT | PATCH | DELETE
    path: /v2/domains/{domainName}
    docUrl: /domains/create  # relative to docsBaseUrl
    async: true              # returns 202 + processId
    authScope: customer      # customer | gateway
    deprecated: false        # optional
    summary: …               # one-liner, used in `rtr list`
    pathParams:  [ … ]
    queryParams: [ … ]
    requestBody:
      fields: [ … ]
    responses:
      "202": { description: "Process acknowledgement …" }
    errors:  [ InvalidParameter, DomainAlreadyRegistered ]
    gotchas: [ "`period` is in months" ]
    examples:
      - title: Register example.com for 1 year
        body: |
          { "registrant": "…", "period": 12 }
```

## Field reference

### Top-level

| Key           | Type   | Required | Notes                                 |
| ------------- | ------ | -------- | ------------------------------------- |
| `category`    | string | yes      | snake-/camel-case filename stem       |
| `label`       | string | yes      | human-friendly heading                |
| `description` | string | yes      | markdown, flowed                      |
| `operations`  | list   | yes      | one entry per endpoint                |

### Per operation

| Key           | Type     | Required | Notes                                         |
| ------------- | -------- | -------- | --------------------------------------------- |
| `operationId` | string   | yes      | camelCase, globally unique across categories  |
| `verified`    | enum     | yes      | `docs` or `sdk`; see `docs/fidelity.md`       |
| `method`      | enum     | yes      | HTTP verb                                     |
| `path`        | string   | yes      | absolute URL path, `/v2/…`                    |
| `docUrl`      | string   | yes      | appended to `docsBaseUrl` in `_shared.yaml`   |
| `async`       | boolean  | yes      | `true` if returns 202 + processId             |
| `authScope`   | enum     | yes      | `customer` or `gateway`                       |
| `deprecated`  | boolean  | no       | default `false`                               |
| `summary`     | string   | yes      | one-line                                      |
| `pathParams`  | list     | no       | `{ name, type, required, description }`       |
| `queryParams` | list     | no       | same shape as pathParams, plus defaults/ranges |
| `requestBody` | object   | no       | `{ fields: [...] }`                           |
| `responses`   | map      | yes      | HTTP code → `{ description }`                 |
| `errors`      | list     | no       | error names resolvable in the global catalog  |
| `gotchas`     | list     | no       | free-form warnings rendered as bullets        |
| `examples`    | list     | no       | `{ title, body }` (body is JSON as a string)  |

### Field shape (`requestBody.fields[n]`)

```yaml
- name: registrant
  type: string            # string | integer | number | boolean | array | object
  required: true
  description: Contact handle of the domain registrant.
  enum: [ … ]             # optional
  minimum: 1              # for numeric
  maxLength: 40           # for string
  items: { type: string } # for array
  properties: { … }       # for nested object (same shape recursively)
  ref: Billable           # optional reference into `_shared.yaml`
```

## Shared types (`_shared.yaml`)

Two top-level sections:

- **`enums`** — named value lists used across categories (for example
  `DomainStatus`, `DcvType`, `ContactRole`).
- **`types`** — reusable nested-object shapes (for example `Billable`,
  `KeyData`, `DsData`, `HostAddress`, `DnsRecord`, `Zone`).

Resolve references with the `ref:` key on any field. Referencing a missing
name is caught by `node scripts/audit-refs.mjs`.

## Validation-only concerns

The JSON Schema emitted by `src/lib/schema.ts` honours:

- `required` (per-field)
- `enum`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`
- `items` for arrays
- `properties` and nested `required` for objects
- `format` shortcuts: `email`, `uri`, `date`, `date-time`, `ipv4`, `ipv6`
- `additionalProperties: false` by default (strict)

Anything outside this list (for example cross-field invariants like the
`keyData` XOR `dsData` rule) lives in `gotchas` and is the caller's
responsibility to enforce.
