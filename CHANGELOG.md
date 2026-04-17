# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-04-17

First public release.

### Added

- Hand-curated YAML spec covering **109 operations** across 16 categories of
  the Realtime Register REST API v2, excluding SiteLock.
- `rtr` CLI with six subcommands: `list`, `describe`, `validate`, `generate`,
  `scrape`, `doctor`.
- JSON Schema derivation from YAML (`ajv` + `ajv-formats`) for validating
  request bodies, query params, and path params.
- Generated Markdown reference under `references/<category>.md` — one file per
  category, authoritative for agent retrieval.
- `SKILL.md` entry point defining when the skill should activate and the
  hard rules (camelCase, `period` in months, DNSSEC XOR, etc.).
- Audit tooling: `scripts/audit-refs.mjs`, `scripts/extract-fields.mjs`,
  `scripts/reconcile-sdk.mjs`.
- Documentation set under `docs/`: agent integration, CLI, spec format,
  fidelity policy.

### Verified

- All 109 operations carry `verified: docs`: path, URL parameters, query
  parameters, and request-content fields reconciled against the live HTML at
  `dm.realtimeregister.com/docs/api`.
- `rtr doctor` confirms all 109 `docUrl` slugs resolve with HTTP 200.
- `scripts/audit-refs.mjs` reports `problems: 0`.

### Categories (109 operations total)

| Category        | Ops | Notes                                               |
| --------------- | --- | --------------------------------------------------- |
| `domains`       | 13  | Core registrar surface, incl. 2 gateway ops         |
| `hosts`         | 5   | Host (nameserver) CRUD                              |
| `contacts`      | 11  | Contact CRUD + validation handlers                  |
| `dnsZones`      | 9   | `{zoneId}`-scoped; `/stats` + process ack-ds-update |
| `dnsTemplates`  | 5   | Customer-scoped (`{customer}/dnstemplates/…`)       |
| `validation`    | 2   | Validation categories under `/v2/validation/…`      |
| `ssl`           | 17  | Certificate lifecycle + product catalog             |
| `sslAcme`       | 7   | ACME subscription lifecycle                         |
| `notifications` | 5   | Notification/subscription management                |
| `processes`     | 5   | Async process polling                               |
| `customers`     | 2   | Customer info                                       |
| `brands`        | 10  | Brand CRUD + mail templates + locales               |
| `financial`     | 4   | Financial summaries                                 |
| `tlds`          | 2   | TLD metadata                                        |
| `providers`     | 7   | Providers + gateway-only registry accounts          |
| `misc`          | 5   | IsProxy + 4 ADAC WebSocket actions                  |

[Unreleased]: https://github.com/makafeli/realtime-register/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/makafeli/realtime-register/releases/tag/v0.1.0
