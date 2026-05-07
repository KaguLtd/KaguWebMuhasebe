# Migration Plan

## Current State

- Repository contains scaffolding only: `apps/`, `docs/`, `scripts/`, and `tests/`.
- Legacy desktop application source is not present in this repository.
- Because the legacy application is the required source of truth, parity analysis is currently blocked until the legacy code, binaries, database samples, or screen captures are provided in a read-only location.
- Existing target web app location already matches the roadmap direction: `apps/muhasebe-web`.

## Working Rules

- Treat the legacy desktop application as read-only source of truth.
- Do not infer accounting rules, validations, report totals, or UI details without legacy evidence.
- Record unknown legacy behavior as `Blocked` or `Pending verification`.
- Keep new web implementation isolated under `apps/muhasebe-web`.
- Update parity and migration docs before or alongside implementation work for each module.

## Phase Plan

| Phase | Goal | Current Status | Immediate Next Step |
| --- | --- | --- | --- |
| 0 | Establish migration rules and repo layout | In progress | Complete planning docs and confirm read-only legacy intake path |
| 1 | Audit legacy app modules, storage, UI, and accounting logic | Blocked | Obtain legacy source or executable plus sample data/screens |
| 2 | Build module parity inventory | Blocked | Derive module list from verified legacy audit |
| 3 | Stand up web app skeleton in `apps/muhasebe-web` | Pending | Confirm current scaffold contents and required baseline |
| 4 | Model PostgreSQL schema and migration rules | Blocked | Inspect legacy data structures before schema design |
| 5 | Add auth and authorization | Pending | Define role model after legacy user/permission review |
| 6+ | Port modules in increasing risk order | Blocked | Finish phases 1-5 with verified parity inputs |

## Actionable Backlog

### 1. Unblock legacy intake

- Add the legacy desktop application to a dedicated read-only location, ideally `legacy/`.
- Provide at least one of the following:
  - source code
  - deployable desktop build
  - database files or exports
  - representative screenshots/videos
  - report samples
- Confirm licensing/access constraints for any external assets or third-party components.

### 2. Perform legacy audit

- Identify entry points, module boundaries, menus, and screen flows.
- Document data storage format and table/file relationships.
- Extract accounting calculations, validations, numbering rules, and report logic.
- Capture UI parity requirements: labels, columns, button names, dialogs, and print/export behaviors.
- Mark each unknown item as `Pending verification`.

### 3. Establish parity tracking

- Create a verified module inventory only after legacy review.
- Track each module by:
  - screens
  - data entities
  - calculations
  - reports
  - exports/printing
  - test coverage
  - parity status

### 4. Validate web scaffold

- Inspect `apps/muhasebe-web` and confirm whether it is empty, placeholder-only, or already initialized.
- Align scaffold with roadmap assumptions:
  - Next.js + TypeScript
  - server-backed auth
  - PostgreSQL
  - testable parity workflow
- Do not implement production accounting behavior before the legacy audit exists.

### 5. Sequence implementation

1. Legacy audit
2. Module parity checklist
3. Web skeleton confirmation
4. Database model proposal
5. Auth and role model
6. Lowest-risk master-data module proof of concept
7. Financial modules only after parity tests exist

## Known Blockers

| Blocker | Impact | Resolution Needed |
| --- | --- | --- |
| No legacy source in repo | Cannot verify module scope, logic, or parity | Add legacy materials in read-only form |
| No sample data or reports | Cannot validate totals, migrations, or report parity | Provide representative exports/databases/reports |
| No confirmed permission model | Auth and authorization may diverge from existing workflows | Verify legacy users, roles, and restrictions |
| No confirmed deployment constraints beyond target domain | Infra choices may be premature | Confirm hosting, backup, and compliance requirements |

## Risks To Control Early

- Rebuilding financial logic from assumption instead of evidence.
- Designing PostgreSQL schema before verifying legacy data relationships.
- Modernizing UI behavior that users depend on in the desktop workflow.
- Implementing imports, exports, or reports without golden legacy outputs.
- Treating repo scaffolding as proof that app foundations are complete.

## Exit Criteria For Planning

- Legacy application is available for read-only analysis.
- Module inventory is evidence-based rather than assumed from the roadmap.
- First parity documents are created from verified legacy inputs.
- Web scaffold scope is confirmed against actual repository contents.
