# AGENTS.md

Rules for every coding agent in this repo. Read fully before writing code. Keep this file under ~120 lines.

Hackathon starter for a travel-booking full stack. 2 people, about one day. Judges are senior engineers who ask
"why did you do it this way?". Every file you write is copied by the next agent, so write each one as the example.

## Priorities (in order)

1. Works end to end.
2. Correct (no double bookings, consistent money and time).
3. Readable and conventional.
4. Extensible.
5. Polish.

**Done is better than perfect.** Build exactly what the task asks. A nice-to-have becomes one line in `docs/IDEAS.md`.

**When two things clash, bend the one that costs less:** what bending does to the customer and to everything that
depends on it, not how much work it is for you. Example: 20 results per page crowded the design; showing 10 cost the
customer almost nothing, while a thinner design would have changed every screen.

## Start here

**New feature? Copy the golden slice from the `bh-boilerplate` repo (for us at `../bh-boilerplate/`):
`apps/api/src/modules/events` and `apps/web/src/features/events`. Copy its patterns, not its events domain.** For a
booking-style write (idempotency, transaction, inventory), copy `modules/reservations` and `features/reservations`
from there. Register the router with one line in `apps/api/src/routes.ts`. Put zod schemas in
`packages/shared/src/<feature>.ts`.

## Layer rules (API, enforced by ESLint)

| Layer      | Does                                                                    | Never does                                                |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| routes     | maps URL + method to a controller                                       | any logic                                                 |
| controller | validates input with shared zod schemas, calls service, shapes response | business rules, DB access, imports repositories or Prisma |
| service    | business rules, orchestration, transactions                             | touches `req`/`res`, imports Express                      |
| repository | data access through Prisma (the only layer that imports Prisma)         | business rules                                            |
| logic      | pure functions: pricing, refunds, ranking, routing                      | I/O, DB, HTTP, reading the clock (`now` is a parameter)   |

Services load data, call logic, run the transaction. Logic decides. Put anything computation-heavy in `*.logic.ts` with a unit test.
Services run transactions with `runInTransaction` from `lib/transaction.ts` and pass the `tx` to repository functions.

## Conventions

- **Money:** integer minor units (`priceMinor`) plus ISO currency code. Never floats. Format only in the UI via `lib/format.ts`.
- **Time:** UTC in the DB (`@db.Timestamptz`), ISO-8601 strings in the API. UI formats with an explicit IANA time zone. Keep a `timeZone` field wherever local time matters.
- **IDs:** own primary keys are cuid. Natural keys from source data (codes) get a unique constraint.
- **Errors:** `throw new AppError(code, httpStatus, message, details?)` from any layer. One middleware returns `{ error: { code, message, details?, requestId } }`. Zod failures are 400 `VALIDATION_ERROR`. Unknown errors are 500 `INTERNAL`.
- **Lists:** accept `page`, `pageSize` (max 100), `sort` (`field` or `-field`), filters. Respond `{ data: T[], meta: { page, pageSize, total } }`.
- **Single resource:** respond `{ data: T }`.
- **Booking-style writes:** require an `Idempotency-Key` header. Same key and same body returns the original result (200). Same key and different body is 422 `IDEMPOTENCY_KEY_REUSED`.
- **Lifecycles:** status enum plus transition timestamp (`cancelledAt`). Snapshot prices onto the record at write time. Never recompute from current prices.
- **Inventory:** atomic conditional decrement (`updateMany` where `available >= qty`, check the count). Never read-then-write.
  In one transaction, insert the record with the unique idempotency key first, then decrement. Throwing rolls both back.
- **UTC connection:** `lib/prisma.ts` forces the database session to UTC. Without it every stored time shifts by the
  server's own time zone. Do not remove it.
- **Frontend states:** every data screen handles loading, empty, error with `components/states/*`. Disable submit while pending. Show friendly messages from `lib/error-messages.ts`, never raw errors.
- **Look and feel:** follow `DESIGN.md`: what each colour, font and shape means, and why. Take colours, fonts and shadows from the tokens and components; never write a hex value or font name in a component.
- **Logging:** use the pino logger from `lib/logger.ts`. No `console.log`.
- **Tests:** integration tests use the real test database. `beforeEach(resetDatabase)` comes from
  `apps/api/test/helpers.ts`. Test races with `Promise.all`, and prove a new test can fail before trusting it.
- **Code style:** named exports only. No default exports (config files excepted). No barrel `index.ts`. Small files, one responsibility.

## Catalog (`data/`)

The catalog is read from `data/raw/hackathon-problem-1-holiday-package/data/catalog/` into memory at startup. Never
change those files: the judges use the originals. Postgres keeps only packages and reservations. `DATA_DICTIONARY.md`
(next to the catalog) explains every field; `PROBLEM.md` ("What the data shows") has the facts and edge cases. Never
hard-code a value from the data: derive it, so the app works on any dataset of the same shape.

## Build order: walking skeleton first

Make the thinnest end-to-end path work (DB to API to screen), ugly is fine, then thicken it. Tag every working state: `git tag demo-N`.

## Scope

Every task must serve a step in `docs/DEMO.md`. Anything else becomes one line in `docs/IDEAS.md`
(idea | demo impact H/M/L | effort S/M/L) and is not built unless asked. Don't discard ideas: actively look for ones that would
make the solution stand out (customer delight, sharp edge-case handling, visible polish) and log them. Once the walking skeleton
works, suggest the top 3 by demo impact ÷ effort.

## Banned (slop)

- Building features nobody asked for (log the idea in `docs/IDEAS.md` instead; see Scope). Config options nobody asked for.
- Speculative abstractions: base classes, factories, generic repositories, interfaces with one implementation.
- Comments that restate the code. Comment only the why.
- Defensive checks for impossible states.
- Refactoring or reformatting code outside the task. Mass reformatting.
- New dependencies without a decision record.
- New docs or READMEs unless asked.
- Mock data where real data exists.
- **Hardcoded values copied from the data** (IDs, names, cities, dates, counts, currencies). Derive them from the data so the app works on any dataset of the same shape.

## Decision records

Significant decisions only (data model, concurrency and consistency, search approach, new dependency, API shape,
anything a judge might question) get `docs/decisions/NNNN-title.md`: Context, Decision, Alternatives considered,
Trade-offs, "30-second answer for judges". Small decisions get one line in your task summary. Write how a decision was
reached, not only the answer, so it adapts: a number like a page size belongs in an example, never in the rule.

## Commands

`npm run setup` (once) | `npm run dev` | `npm run check` (typecheck + lint + tests) | `npm run db:reset` |
`npm run format`

`npm run db:reset` and the tests may wipe the local databases without asking (both carry consent for Prisma's AI guard).
Never run raw Prisma reset commands: any other destructive Prisma command still needs the user's yes.

## Definition of done

- `npm run check` passes.
- Loading, empty and error states are handled.
- The demo path in `docs/DEMO.md` still works.
- If a decision was settled or what is built changed, `docs/SOLUTION.md` says so. Never put solutions in `PROBLEM.md`.
- End with a short summary: what changed, files touched, decisions made.

## Git

Small commits with clear messages. Never force-push or rewrite history. Never mass-reformat. Tag working states `demo-N`.

## More detail

`README.md` | `DESIGN.md` (look and feel) | `docs/decisions/` | `docs/TASK_TEMPLATE.md` | `PROBLEM.md` | `docs/SOLUTION.md` | `docs/DEMO.md` | `docs/IDEAS.md`
