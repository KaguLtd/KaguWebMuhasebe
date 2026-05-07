# Decisions

## Confirmed

| Decision | Status | Notes |
| --- | --- | --- |
| Legacy desktop application is the source of truth | Confirmed | New web behavior must be derived from the legacy app, not reimagined |
| Legacy materials must be treated as read-only | Confirmed | No edits to legacy code or assets |
| New web application lives separately from legacy code | Confirmed | Repo already includes `apps/muhasebe-web` |
| Primary planning docs live under `docs/` | Confirmed | This file and `MIGRATION_PLAN.md` start that record |
| Unknown legacy details must be explicitly marked | Confirmed | Use `Blocked` / `Pending verification` instead of guessing |
| `legacy/source/KAGU-ERP-D1` is the active legacy reference | Confirmed | Cloned from `https://github.com/KaguLtd/KAGU-ERP-D1` on April 30, 2026 |

## Verified Legacy Findings

| Topic | Finding | Status |
| --- | --- | --- |
| Legacy runtime | Electron + React 19 + Vite | Confirmed |
| UI library | Ant Design + custom beige theme | Confirmed |
| Local persistence | `better-sqlite3` | Confirmed |
| Main logic split | `src/main` business/data layer, `src/renderer` UI layer | Confirmed |
| Money storage style | Minor-unit integers such as `amount_minor`, `debit_minor`, `credit_minor` | Confirmed |
| Inventory/accounting links | `account_ledger_entries`, `stock_movements`, invoice/delivery note links | Confirmed |
| Current module family | accounts, projects, warehouses, items, delivery notes, invoices, receipts, transfers, settings | Confirmed |

## Working Assumptions

| Decision | Status | Notes |
| --- | --- | --- |
| Repository is intended to host both planning docs and new web build | Assumed | Supported by current `apps/`, `docs/`, `legacy/`, `scripts/`, `tests/` layout |
| `apps/muhasebe-web` is the intended target app path | Assumed | Matches roadmap recommendation; verify if another path is preferred |
| Migration will proceed phase-by-phase with parity checks | Assumed | Directly aligned with roadmap and low-risk for accounting work |

## Blocked Pending Verification

| Topic | Why Blocked | What Must Be Verified |
| --- | --- | --- |
| Legacy screenshots and operator flows | Source code exists, but screen-by-screen capture pack is still missing | Exact visual rhythm, spacing, dialogs, and usage flow |
| Legacy reporting/export behavior | Source code exists, but sample outputs are still missing | Filters, columns, totals, PDF/Excel/print behavior |
| Auth and permissions model | Legacy user flows not available | Roles, access restrictions, session expectations |
| Production deployment shape | Roadmap suggests options but repo does not confirm one | VPS/Docker vs other hosting, backup, SSL, operations constraints |

## Technical Direction From Roadmap

| Topic | Current Direction | Status |
| --- | --- | --- |
| Frontend | Next.js + React + TypeScript | Provisional |
| Styling | Tailwind CSS, but visual system must move toward KAGU-ERP-D1 palette/layout patterns | Provisional |
| Backend | Full-stack Next.js app or equivalent Node-backed server | Provisional |
| Database | PostgreSQL target, with legacy SQLite semantics preserved during migration | Provisional |
| ORM | Prisma preferred | Provisional |
| Auth | Custom credentials auth with server-side sessions preferred | Provisional |
| Hosting target | `muhasebe.kagultd.com` | Confirmed target domain |

## Realignment Notes

- The current Next.js scaffold is acceptable as a web target, but it is not yet UI-parity accurate.
- The current scaffold must stop inventing desktop visual language and instead follow the legacy app's beige/light Ant Design-derived visual tone.
- Accounting migration planning must account for the legacy app's use of integer minor units instead of assuming only decimal-field semantics.
- Menu and module names should be aligned with the actual legacy app before deeper implementation starts.

## Repo-Specific Notes

- The roadmap statement that the repository contains only `.git` and `.codex` is no longer accurate for the current workspace.
- Current workspace now includes `apps/`, `docs/`, `legacy/`, `scripts/`, and `tests/`.
- The main blocker is no longer "missing source code"; it is now missing screenshots, operator walkthroughs, and sample report outputs.

## Decision Log Rules

- Add new entries when a technical or process choice changes delivery risk or parity expectations.
- Prefer short entries with explicit status: `Confirmed`, `Assumed`, `Provisional`, or `Blocked pending verification`.
- When legacy evidence contradicts a roadmap assumption, update this document before implementation continues.
