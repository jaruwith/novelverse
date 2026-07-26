# NovelVerse Engineering Rules

This handbook is the permanent engineering standard for NovelVerse. It is the
single source of truth for implementation workflow, architecture boundaries,
repository safety, validation, and sprint completion. Every future
implementation prompt must incorporate these rules by reference and add only
the sprint-specific goal.

These rules apply across the workspace unless the project owner explicitly
overrides a rule for a particular task. A sprint goal may narrow authority, but
it does not silently broaden it.

## 1. Project Philosophy

### Backend is the source of truth

The backend owns persisted state, authorization, lifecycle transitions,
validation, and public contracts. Frontend state and validation improve user
experience but never replace server enforcement. When documentation, mock data,
frontend assumptions, and the live API disagree, inspect the backend contract
and database model before deciding what is correct.

### Domain first

Model the domain and its invariants before designing endpoints or UI. Business
rules belong in domain entities or application services according to the
existing Clean Architecture boundary. Controllers, EF configurations, and React
components must not become alternate homes for domain policy.

### Functional UI before polished UI

Complete the real vertical slice before visual refinement:

1. correct backend contract;
2. persistence and authorization;
3. real frontend integration;
4. automated tests and browser validation;
5. visual polish.

Do not redesign screens during a foundation sprint unless redesign is the
explicit sprint goal.

### Build reusable foundations

Prefer abstractions and domain models that support known future consumers.
Avoid one-off fields, endpoints, or UI paths that bypass an existing reusable
foundation. Reuse existing architecture and conventions before introducing new
patterns.

### One rule, one authoritative implementation

Do not duplicate business rules across controllers, services, queries, and
frontend components. The backend enforces the rule once. The frontend may
mirror safe presentation constraints, such as input length or accepted file
types, but backend enforcement remains authoritative.

### Completion includes the browser

A feature is not complete merely because it compiles or its isolated tests
pass. The real API, database, frontend, and browser workflow must operate
together. Browser E2E and the vertical-slice smoke test are part of completion,
not optional post-sprint activities.

### Evidence over assumption

Inspect current code, schema, migrations, configuration, tests, running
processes, and API responses before changing behavior. Report verified results
and distinguish failures caused by implementation from failures caused by
external infrastructure.

## 2. Workspace Layout

The shared workspace is:

```text
C:\work
├── ENGINEERING_RULES.md
├── NovelVerseApi
└── novelverse
```

### `C:\work\NovelVerseApi`

The .NET backend repository contains:

- `NovelVerse.Domain` — entities, enums, domain rules, and domain exceptions;
- `NovelVerse.Application` — use cases, contracts, services, requests, and
  responses;
- `NovelVerse.Infrastructure` — EF Core, PostgreSQL, queries, authentication,
  storage providers, migrations, and external implementations;
- `NovelVerse.Api` — controllers, HTTP behavior, middleware, configuration,
  OpenAPI, and application startup;
- `NovelVerse.Api.Tests` — unit, HTTP integration, PostgreSQL, migration,
  OpenAPI, and smoke coverage;
- `docs` and `scripts` — durable technical documentation and local workflows.

### `C:\work\novelverse`

The Next.js frontend repository contains the existing API-backed application,
typed API integration, creator tools, readers, tests, and browser scripts.

### Repository authority by sprint

The sprint prompt must state which repository is primary and what modification
authority exists:

- Backend sprint: `NovelVerseApi` is normally writable. `novelverse` is
  read-only unless minimal integration or browser verification is explicitly
  required.
- Frontend sprint: `novelverse` is normally writable. `NovelVerseApi` is
  read-only unless a verified contract defect requires an explicitly authorized
  backend correction.
- Cross-stack or integration sprint: both may be writable, but changes must
  remain limited to the vertical slice.
- Documentation or review task: both product repositories are read-only unless
  the request explicitly authorizes documentation changes inside them.

Read both repositories before cross-stack implementation. Never create a
parallel client, domain model, persistence path, or orchestration workflow
without first confirming that an existing convention cannot be extended.

## 3. Development Workflow

Every sprint follows this sequence:

```text
Requirement
    ↓
Architecture
    ↓
Implementation
    ↓
Build
    ↓
Unit Tests
    ↓
Integration Tests
    ↓
Vertical-Slice Smoke
    ↓
Browser E2E
    ↓
Architecture Review
    ↓
Project Owner Visual Review
    ↓
Commit
    ↓
Push
```

### Requirement

Identify the product outcome, in-scope behavior, explicit exclusions,
authorization rules, lifecycle rules, contracts, migration needs, tests, and
completion phrase. Resolve contradictions against current code and verified
product decisions. Do not infer authority for unrelated cleanup or redesign.

### Architecture

Inspect the current implementation and make an internal contract map:

- domain entities and enums;
- ownership and lifecycle rules;
- application services and interfaces;
- EF mappings, relationships, and migrations;
- HTTP routes, authentication, and Problem Details;
- frontend types, API client, state flow, rendering, and tests;
- local orchestration, smoke, and E2E workflows.

Select the smallest design that fits existing architecture and known future
consumers. Document material decisions and limitations.

### Implementation

Implement from the domain outward:

1. domain model and invariants;
2. application contracts and use cases;
3. infrastructure and persistence;
4. migration;
5. HTTP contract;
6. minimal real frontend integration;
7. tests, scripts, and documentation.

Keep changes scoped. Preserve unrelated work and existing behavior.

### Build

Restore dependencies when needed and build early. Rebuild after contract,
migration, dependency, or startup changes. A running API may lock build output
on Windows; stop the confirmed API process before rebuilding rather than
working around stale binaries.

### Unit tests

Test deterministic domain and application behavior without external
infrastructure. Include validation boundaries, lifecycle transitions, security
rules, serialization, UI state, and regression cases.

### Integration tests

Use real PostgreSQL through Testcontainers for relational behavior, migrations,
indexes, foreign keys, transactions, ownership, HTTP contracts, and OpenAPI.
Do not replace database integration coverage with an in-memory provider.

### Vertical-slice smoke

Run the narrow real HTTP workflow against the local migrated database. It must
use real authentication, real persistence, and the current API process. Smoke
tests detect stale processes, migration drift, routing mismatches, and
cross-layer contract defects.

### Browser E2E

Run the actual browser against the real frontend and API. Verify persistence
after reload, authentication, relevant lifecycle transitions, rendered output,
and absence of mock fallback. Do not log tokens or preserve token-bearing
screenshots, traces, or reports.

### Architecture review

Review domain ownership, abstraction boundaries, persistence, authorization,
contracts, failure consistency, security, tests, and future extensibility.
Architecture review begins only after required automated and browser validation
has passed or remaining external blockers are explicitly reported.

### Project owner visual review

The project owner reviews visible behavior after architecture correctness.
Visual review is not a substitute for functional validation. UI polish changes
must not silently alter backend contracts or business rules.

### Commit and push

Commit and push occur only after explicit project-owner authorization. The
default Codex implementation task stops before both operations.

## 4. Environment Orchestration

Environment health is a mandatory gate before smoke, browser E2E, or final
implementation validation.

### Required startup order

1. Detect listeners and running NovelVerse processes.
2. Stop a stale or outdated NovelVerse API.
3. Verify Docker Engine is available.
4. Verify `novelverse-postgres` exists, is running, and accepts connections.
5. Restore the repository-pinned EF tool when necessary.
6. Apply pending EF Core migrations.
7. Build the API when source or dependencies changed.
8. Start the API using the intended Development configuration.
9. Poll the API health endpoint until it returns HTTP 200.
10. Detect the frontend listener.
11. Start the frontend only if it is not already running.
12. Poll a stable frontend route until it returns HTTP 200.
13. Execute the API vertical-slice smoke test.
14. Execute browser E2E.
15. Begin the remaining validation suite only after the environment is healthy.

### Detecting stale processes

Inspect the listeners for the configured local ports, currently API port `5039`
and frontend port `3000`. Resolve each listener to its owning PID, executable
path, parent process, and command line.

A process is confirmed as the NovelVerse API only when its executable or command
line resolves to `C:\work\NovelVerseApi`. A frontend process is confirmed only
when its command line resolves to `C:\work\novelverse`. Never terminate a
process based only on the generic name `dotnet`, `node`, or a port assumption.

An API is stale when any of the following applies:

- backend source, dependencies, startup, configuration, or migration changed
  after the process started;
- the expected route or OpenAPI operation is missing;
- the process is running old Debug or Release output;
- database migration state and loaded application model differ;
- health checks fail or smoke/E2E proves the running contract is outdated.

### Stopping and restarting the API

Attempt a graceful, non-forced stop first. On Windows, a headless process may
not expose a graceful close channel. If Windows confirms that only forced
termination is possible, force-stop only the previously verified NovelVerse API
PID. Confirm the API port is free before rebuilding or restarting.

Restart the API after:

- migrations are added or applied;
- backend assemblies or package references change;
- dependency injection, middleware, routes, JSON options, authentication,
  storage, or configuration binding changes;
- smoke or E2E indicates an old contract;
- build output was previously locked by the running API.

Do not restart the API merely to hide an unexplained failure. Diagnose first.

### Docker and PostgreSQL

Verify both Docker client and server, not only that the Docker executable
exists. `novelverse-postgres` must be running and `pg_isready` must report that
it accepts connections. Start only the named project container. Do not stop,
remove, or recreate unrelated containers.

Apply migrations with the repository-pinned EF CLI and the correct startup
project. Never edit previous migrations. Confirm migration success from EF
output or correctly quoted migration-history queries.

### Service startup

Start background services hidden and retain logs in a temporary location.
Do not create visible command windows unless interactive control is necessary.
Poll with bounded timeouts and surface startup logs on failure. Never use an
unbounded sleep.

### Current local verification targets

- API health: `http://localhost:5039/api/v1/health`
- Frontend reachability: `http://localhost:3000/login`
- API smoke:
  `NovelVerseApi\scripts\smoke-local-vertical-slice.ps1`
- Browser E2E:
  `npm run test:e2e:local` from `C:\work\novelverse`

PowerShell execution policy may require invoking the smoke script with a
process-scoped bypass. Do not change the machine-wide execution policy.

## 5. Repository Rules

### Preserve all existing work

Assume every tracked modification and untracked file belongs to the project
owner unless proven otherwise. Capture `git status --short` before and after a
sprint. Distinguish pre-existing work, sprint changes, and generated artifacts.

### Never perform these operations by default

Do not:

- reset;
- stash;
- clean;
- discard or restore user changes;
- amend or rewrite history;
- commit;
- push;
- pull with merge side effects;
- merge;
- rebase;
- create or delete tags;
- delete branches;
- force-update refs.

These operations require explicit project-owner authorization and an exact
scope. A request to implement, validate, or finish a sprint is not authorization
to commit or push.

### Worktree safety

- Inspect repository instructions such as `AGENTS.md` before editing.
- Work around unrelated dirty files.
- If an in-scope file already has changes, understand and preserve them.
- Do not normalize, reformat, or rewrite unrelated files.
- Do not modify old EF migrations.
- Do not add generated build, coverage, media, trace, screenshot, or secret
  artifacts.
- Use repository-local ignore rules for durable generated directories.
- Run `git diff --check` in every modified repository.

### Generated artifacts

Keep `bin`, `obj`, `.next`, coverage, Playwright reports, screenshots, traces,
temporary media, and local secrets untracked. Test fixtures should be generated
in memory or under a verified temporary directory and removed afterward.

## 6. Backend Rules

### Clean Architecture boundaries

- Domain has no dependency on Application, Infrastructure, or API.
- Application defines use cases and interfaces needed from Infrastructure.
- Infrastructure implements persistence and external concerns.
- API translates HTTP input/output and resolves authenticated identity.
- Controllers remain thin and do not contain business workflows.

Follow existing conventions before adding a new abstraction.

### Domain rules

Entities own intrinsic invariants and lifecycle transitions. Use explicit enums
with stable persisted values. Preserve timestamp and soft-delete conventions.
Domain deletion must not silently corrupt references.

### Application services

Application services orchestrate authorization prerequisites, ownership,
cross-aggregate validation, transactions, and mapping to safe response
contracts. Do not return EF entities directly. Use cancellation tokens across
I/O and persistence boundaries.

### Persistence and EF Core

- PostgreSQL is the authoritative relational database.
- Use explicit table and column mappings consistent with current snake_case
  schema.
- Configure string lengths, enum conversions, timestamp types, indexes, unique
  constraints, foreign keys, and deletion behavior explicitly.
- Prefer restrictive deletion for reusable referenced assets.
- Add a new migration; never modify a previously created migration.
- Review generated migration SQL and model snapshot.
- Test relational behavior with PostgreSQL/Testcontainers.
- Use transactions and existing unit-of-work conventions for multi-step writes.

### Authentication and authorization

- Resolve authenticated user ID from verified JWT claims through the shared
  claims helper.
- Require active-account state where the operation demands it.
- Apply creator/profile prerequisites only when justified by the product rule.
- Ownership is checked server-side for every protected aggregate.
- Conceal non-owned resources using the established 404 behavior.
- Never log access tokens, refresh tokens, secrets, or sensitive claims.

### HTTP contracts

- Use versioned `/api/v1` routes and current controller conventions.
- All endpoints must appear in OpenAPI/Scalar when applicable.
- Serialize enums using the established public casing.
- Treat multipart/form values explicitly when JSON enum conversion does not
  apply.
- Use safe response DTOs and never expose physical paths or persistence
  entities.
- Public-access decisions must be explicit and documented.

### Problem Details

Use the shared exception-to-Problem-Details mapping:

- validation → 400 with field errors;
- authentication → 401;
- forbidden → 403;
- missing or ownership-concealed → 404;
- lifecycle/reference conflict → 409;
- unexpected failure → 500 without internal details.

Do not invent endpoint-specific error envelopes.

### Validation and security

Do not trust filenames, client MIME types, extensions, IDs, ownership claims, or
frontend validation. Validate actual content and persisted relationships.
Configure request limits at both transport and application levels where
appropriate. Prevent traversal and user-controlled physical paths. Use
generated opaque identifiers. Set safe content and caching headers.

Never claim that moderation, malware scanning, transformation, or another
security control exists unless it is implemented and tested.

### Storage

Keep storage behind an application-owned abstraction. Provider implementations
must prevent traversal and overwrite, stream I/O where practical, honor
cancellation, and avoid physical-path exposure. Database and storage failure
consistency must be deliberate and tested. Local development storage must be
configurable and ignored by Git.

### Backend tests

Use focused domain tests plus real HTTP/PostgreSQL integration tests. Generate
small fixtures in tests rather than committing large binaries. Cover OpenAPI,
migrations, authorization, ownership concealment, persistence, indexes,
constraints, lifecycle conflicts, public contracts, and important failure
cleanup.

## 7. Frontend Rules

### Use the typed API client

All backend calls go through the established typed client and shared
authentication flow. Do not introduce ad hoc `fetch` behavior that bypasses
token attachment, refresh rotation, error mapping, or API base configuration.

### Backend contract only

Model the verified API response. Do not invent fields, lifecycle transitions, or
authorization decisions in the frontend. Do not fall back to mock data when a
real API exists for the feature. Mock data may remain only in intentionally
static or not-yet-integrated product areas.

### Preserve authentication behavior

Bearer authentication, refresh-token rotation, session clearing, and 401
handling must remain centralized. Multipart requests must not manually set a
JSON content type or multipart boundary. Never expose tokens in UI, logs,
screenshots, traces, URLs, or test reports.

### Typed state and serialization

Use discriminated unions and explicit DTOs. Serialize only backend-defined
fields. Preserve stable server identifiers through editing and autosave. Do not
embed uploaded media as base64 in domain payloads.

### Functional UI

Implement the minimum interaction required to complete the real workflow:

- loading, disabled, empty, error, and success states;
- duplicate-submission protection;
- accessible native controls where appropriate;
- persistence after reload;
- Preview and public rendering.

Do not add dashboard redesign, animation, or unrelated polish during foundation
sprints.

### Autosave and concurrency

Preserve content while requests fail. Prevent overlapping saves from corrupting
revision state. Serialize mixed content deterministically. Warn before leaving
with unsaved changes. A successful upload or related side effect must not create
an invalid domain block until the backend operation has succeeded.

### Problem Details

Parse the backend’s shared Problem Details contract. Show useful Thai messages
for validation, authorization, network, and lifecycle failures without exposing
trace IDs or internal server details to users.

### Do not duplicate business rules

Frontend validation is a usability layer. The server remains authoritative.
Do not implement independent ownership, publication, account-state, or media
validity rules in React.

### Rendering security

Do not introduce arbitrary HTML or `dangerouslySetInnerHTML`. Render plain text
as text. Render media only from backend-provided safe content URLs. Avoid manual
GUID inputs and user-controlled URL execution.

## 8. Testing Rules

### Required validation order

Environment orchestration and health checks precede implementation validation.
Once healthy, validate in this order.

### Backend

1. `dotnet restore`
2. Release build
3. unit tests
4. PostgreSQL/Testcontainers integration tests
5. migration and OpenAPI discovery tests
6. local API or feature smoke
7. vulnerable-package scan
8. `git diff --check`

Use Release builds when a previously running Debug API has locked output, but
normally stop and restart the confirmed API so the validated binary is also the
running binary.

### Frontend

1. dependency installation when required;
2. lint;
3. typecheck;
4. all unit/component tests;
5. production build;
6. browser E2E against the real stack;
7. `npm audit`;
8. `git diff --check`.

Do not run `npm audit fix --force`.

### Browser E2E requirements

Use generated small fixtures and real APIs. Verify relevant onboarding,
creation, editing, save, reload, lifecycle transitions, Preview/public output,
and the absence of mock fallback. A passing HTTP upload alone does not prove UI
integration; a visible browser result and persisted reload are required.

### Vulnerability scans

Run NuGet and npm advisory scans after dependencies are restored. Any known
vulnerability must be reported with package, dependency depth, severity, and
whether an upgrade is safe within scope.

An advisory service outage or malformed registry response is an external
validation blocker, not proof that dependencies are safe. Retry reasonably,
record the exact failure, do not alter lockfiles merely to make the command
quiet, and do not claim a clean scan without a valid response.

### External infrastructure failures

Classify failures precisely:

- Docker Engine unavailable;
- Docker named-pipe permission denied;
- PostgreSQL not ready;
- package registry unavailable;
- browser binary unavailable;
- port occupied by a stale process;
- test assertion or implementation defect.

Fix in-scope environment problems and rerun. Do not mark tests passed because
infrastructure prevented execution. Once infrastructure is healthy, rerun the
entire affected suite, not only the previously failing test.

### Test-result reporting

Report exact totals for discovered, passed, failed, and skipped tests. Preserve
pre-existing failures and distinguish them from sprint regressions. Never hide
or relabel a failure.

## 9. Definition of Done

A sprint is complete only when all applicable conditions are satisfied:

- architecture matches existing boundaries and the sprint goal;
- domain and authorization rules are implemented server-side;
- required database migration is additive, reviewed, and applied successfully;
- backend restore and build pass without unresolved warnings;
- all backend unit and PostgreSQL integration tests pass;
- frontend lint and typecheck pass;
- all frontend tests pass;
- production frontend build passes;
- real API smoke passes;
- real browser E2E passes;
- persisted behavior survives reload;
- OpenAPI exposes applicable endpoints;
- vulnerability scans complete without unresolved findings;
- documentation and configuration examples are current;
- local generated artifacts and secrets are untracked;
- `git diff --check` passes in every modified repository;
- there is no unresolved regression, security gap, or unexplained failure;
- final repository statuses are reported;
- architecture review is ready;
- the project owner has the evidence needed for visual review.

If a required condition is blocked externally, the sprint is not fully ready.
Report the exact blocker and the successful evidence separately. Do not use
near-completion as a reason to weaken the Definition of Done.

Commit and push are not part of Codex’s default Definition of Done. They happen
only after review and explicit authorization.

## 10. Prompt Rules

Future implementation prompts should contain only:

```text
Engineering Rules
+
Sprint Goal
```

### Engineering Rules

Reference this file:

```text
C:\work\ENGINEERING_RULES.md
```

The prompt should require the implementer to read and follow it completely.
Do not repeat orchestration, repository safety, validation order, Clean
Architecture, Problem Details, authentication, test, or completion boilerplate
already defined here.

### Sprint Goal

The sprint-specific section should define:

- sprint or Epic name;
- product outcome;
- primary repository and modification authority;
- in-scope behavior;
- explicit exclusions;
- domain and authorization requirements unique to the sprint;
- required public contracts;
- migration or compatibility constraints;
- sprint-specific acceptance tests;
- required documentation;
- final review phrase, if one is needed.

Prompts must not prescribe a parallel architecture. They may recommend a shape,
but implementation must first inspect and reuse current conventions. Temporary
environment instructions belong in this handbook or a durable development
script, not repeated in every sprint prompt.

## 11. Epic Roadmap

Status reflects the established foundation at the time this handbook was
created.

| Order | Epic | Status | Foundation |
|---:|---|---|---|
| 1 | Identity | Completed | JWT, refresh tokens, legal acceptance, users, profiles |
| 2 | Story | Completed | creator-owned stories, taxonomy, lifecycle, public contracts |
| 3 | Episode | Completed | episode ownership, lifecycle, ordering, publication |
| 4 | Novel | Completed | TEXT, IMAGE, and DIVIDER content-block foundation |
| 5 | Integration | Completed | real API-backed frontend, local smoke, browser workflow |
| 6 | Media | Completed | reusable image assets, local storage, upload, delivery |
| 7 | Comic | Completed | comic page authoring using Media Assets and functional reader |
| 8 | Video | Completed | provider-neutral video metadata references and functional playback |
| 9 | Reader | Planned | production novel/comic/video reading experiences |
| 10 | Search | Planned | indexed discovery and filtering |
| 11 | Moderation | Planned | reports, review queues, asset/content policy enforcement |
| 12 | Monetization | Planned | memberships, purchases, payouts, advertisements |
| 13 | UI Polish | Planned | cohesive visual refinement after functional completeness |
| 14 | Accessibility | Planned | systematic WCAG review and remediation |
| 15 | Performance | Planned | measurement-driven API, database, media, and frontend work |

“Completed” means the reusable foundation exists. It does not mean every future
consumer or production-hardening task for that domain is finished.

## 12. Lessons Learned

### The backend is the contract

Frontend assumptions drift quickly when they are based on wireframes or mock
data. Inspect controllers, DTOs, enum serialization, Problem Details, and
OpenAPI. Multipart binding can differ from JSON serialization; test the actual
wire contract.

### Restart after backend or migration changes

A healthy-looking stale API can still serve an old contract. Missing new routes
and locked assemblies are strong signals. Stop the verified process, apply
migrations, rebuild, restart, and wait for health before validation.

### Smoke tests find cross-layer failures

Unit tests cannot prove local authentication, migrations, routing,
configuration, and persistence all work together. The vertical-slice smoke test
must remain narrow, deterministic, and real.

### Browser E2E finds integration defects

The Media foundation compiled and unit tests passed while the actual multipart
enum value still failed at the HTTP boundary. Browser E2E found the defect.
Never skip browser validation for a user-facing vertical slice.

### Generated fixtures must be valid

Hand-authored binary base64 can be corrupt. Generate small fixtures with a
maintained encoder or a deterministic standards-correct helper. Remove
temporary files and failure screenshots after the run.

### Culture affects persistence-adjacent formatting

Dates used in storage keys, slugs, hashes, or other durable identifiers must use
invariant formatting. Local Thai culture exposed a Buddhist-year storage path.
Durable keys must not depend on machine locale.

### Functional UI comes first

The existing UI should be changed only enough to complete and verify the real
workflow. Correct upload, persistence, reload, error handling, and Preview are
more important than visual redesign during a foundation Epic.

### Docker and Testcontainers require real access

Having Docker installed is insufficient. Verify Engine connectivity and named
pipe permissions. A Testcontainers failure before assertions is an
infrastructure failure; restore access and rerun the full suite before drawing
conclusions.

### Advisory outages are not clean scans

NuGet or npm registry failures must be reported as blockers. A malformed
advisory response does not establish that dependencies are safe.

### Preserve dirty worktrees

NovelVerse development often spans multiple uncommitted vertical slices. Initial
and final status reporting protects that work. Never use reset, stash, clean, or
unrelated formatting to simplify the workspace.

### Architecture review follows evidence

Build output alone is insufficient. Architecture review should receive passing
unit, PostgreSQL, smoke, browser, build, and security evidence together with
explicit limitations and repository status.

## 13. Handbook Maintenance

Update this handbook only when a durable engineering convention changes.
Product-specific rules belong in domain documentation; temporary sprint results
belong in sprint documentation; command troubleshooting that remains useful
belongs in development documentation or scripts.

Changes to this handbook must:

- preserve established safety and validation guarantees;
- reflect verified repository behavior;
- avoid embedding secrets or developer-specific paths outside `C:\work`;
- remain concise enough to be read at the start of every sprint;
- be reviewed as an engineering-process change, not a product feature.

## 14. Handbook Distribution

`C:\work\ENGINEERING_RULES.md` is the workspace convenience copy used by local
implementation prompts. Tracked mirrors live at:

- `NovelVerseApi\docs\ENGINEERING_RULES.md`;
- `novelverse\docs\ENGINEERING_RULES.md`.

All three copies must remain byte-identical. A durable handbook change is
complete only when both repository mirrors are updated together. Product and
sprint documentation must link to the handbook instead of redefining its rules.
