# UX Contract

## Product context

- **Audience:** Engineers and technical leads exploring public JavaScript/TypeScript repositories.
- **Primary jobs:** Analyze a repository, understand the city overview, search/select a file, inspect metrics/findings, and recover from analysis failures.
- **Target market(s):** Global developer tooling.
- **Active locales:** English in V1; repository paths and code identifiers are preserved verbatim.
- **Language/content register:** Plain technical English; action labels use direct verbs.
- **Timezone/calendar policy:** Not applicable to the current flow.
- **Accessibility target:** WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Product purpose and safe analysis boundary | `README.md` | Product README | 2026-09-20 |
| Repository ingestion limits and no-code-execution policy | `packages/repository-ingestion/src/github-core.ts` | Implementation/API evidence | 2026-09-20 |

## Visual contract

- **Project `DESIGN.md`:** `DESIGN.md`
- **Token ownership:** Existing runtime CSS variables are canonical; `DESIGN.md` mirrors the accepted semantic values.
- **Runtime source:** `apps/web/app/globals.css`
- **Mapping:** CSS semantic variables are consumed directly by shared workbench and landing selectors.
- **Token drift gate:** `audit_project.py --mode strict`, `designmd lint DESIGN.md`, and live browser screenshots.
- **Supported themes:** Dark atlas theme in V1; forced-colors remains system-operable.
- **Design-context owner:** Product UI changes update `DESIGN.md` only when a durable system decision changes.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | `RepositoryExperience` repository form | This contract + `README.md` | analyze / cancel / error | browser + unit stream tests |
| Scrollbar | Global `globals.css` baseline | `DESIGN.md` | panel geometry exceptions | computed style + browser |
| Search | `CitySearch` | This contract | local file search | keyboard + browser |
| Findings selection | `FindingsPanel` | This contract | focus building | browser interaction |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | clear intent and stable size | raised surface/border | visible ring | pressed tone | muted, no pointer | label remains stable | inline alert when action fails |
| Input | labeled and readable | border lift | ring | n/a | muted | n/a | `aria-invalid` + inline text |
| Search | local filter + clear | surface lift | ring | n/a | n/a | n/a | no-results state |
| List item | path + LOC | raised row | ring | selected mint/blue state | n/a | n/a | n/a |

## Dataset navigation

- **Admin tables:** Not applicable.
- **Exploratory lists:** Explorer and findings render the bounded analyzed model; panel scroll owns overflow.
- **URL state:** Not persisted in V1; analysis is a single-session exploration, not a shareable saved project yet.
- **Empty/no-results/error/loading:** Explorer shows no-results text for search; landing shows stage progress, inline error, retry via resubmit, and cancel for active analysis.
- **Back/scroll restoration:** No route navigation in V1; preserve panel scroll during selection.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Analyze repository | `Build my city` | Stage status + Cancel, duplicate submit blocked | City overview | Streamed result + model HUD | Inline error with resubmit | Focus remains on form unless user selects a file | `apps/web/app/api/analyze/route.ts` |
| Search | Type in `Find file or path…` | Immediate local filtering | Same workspace | Result list updates | Clear action / no-results copy | Input remains focused | `apps/web/components/city/search.tsx` |
| Focus file | Explorer/finding/3D click | Camera transition when motion allowed | Same workspace | HUD + inspector update | No-op if target missing | Selected control remains current | `apps/web/components/city/camera-rig.tsx` |
| Cancel/back | `Cancel` or `Analyze another repo` | Request abort where active | Landing form | None beyond state reset | Preserve safe URL text | Form is available again | `apps/web/components/city/repository-experience.tsx` |

## Navigation and responsive behavior

- **Route document title:** `CodeCity` for the single V1 route; loading/error remain within the same title.
- **Route error behavior:** Inline application error; no raw stack traces.
- **Navigation:** No tabs/breadcrumbs; explorer and inspector are persistent workbench panels.
- **Responsive transformation:** Desktop three-zone layout; tablet inspector below city; narrow layout stacks explorer, city, inspector with bounded panel scrolling.
- **Truncation:** Important paths wrap; file names remain available as visible text and accessible labels.
- **Focus restoration:** Focus stays on the triggering button/input; camera focus is user-triggered and reduced-motion safe.

## Overlays and feedback

- **Dialog primitive:** None in current V1.
- **Toast:** None in current V1; inline status is canonical for analysis.
- **Alert scope:** Analysis failure is inline on the landing form; progress is an ARIA live status.
- **Layer contract:** Search results sit above explorer content; fixed Analyze button stays above workbench panels.

## Async and resilience

- **Mutation default:** Pessimistic streamed analysis; city is shown only after the result event arrives.
- **Duplicate-submit policy:** Abort previous controller before starting a new analysis; disable input and button while running.
- **Offline/timeout:** Show a stable inline error from the request; user can submit again. No automatic retries that could repeat external GitHub work.
- **Long-running progress:** Named stages, indeterminate pulse, Cancel, and no fake percentage.
- **Stale cancellation:** `AbortController` invalidates prior analysis; late responses do not overwrite a newer request.

## Validation

- **Owner:** `RepositoryExperience` owns client-side URL shape validation and server error display.
- **Trigger:** Validate on submit, not while typing.
- **Error policy:** Inline `role=alert`, `aria-invalid`, and `aria-describedby`; preserve the entered repository URL.
- **Recovery:** Correct URL and resubmit; Cancel restores idle state.
- **Form semantics:** `noValidate`, real label, stable busy button, no duplicate submission.

## Verification

- **Required commands:** `pnpm test`, `pnpm typecheck`, `pnpm build`, premium audit.
- **Browser matrix:** Desktop/small laptop and narrow in-app browser; loading, success, invalid URL, cancel, search, and selection.
- **Accessibility:** semantic buttons/labels, live progress/error regions, visible focus, contrast and keyboard search.
- **Canonical sibling flow:** Landing → workspace is the only V1 product flow; both surfaces share the same semantic palette and action vocabulary.
