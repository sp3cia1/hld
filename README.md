# Build My Holiday

A traveler enters 7 facts (departure city, country, start date, nights, adults, children's ages, budget). The app
chooses the cities and builds one complete holiday package: flights, hotels, airport transfers, transfers between
cities and attractions, with every travel rule checked. The traveler can change the hotel, a flight or the
attractions, then confirm to get a 10-digit reservation number. Problem: [PROBLEM.md](PROBLEM.md).

## Start the app

**You need:** Node 22.13 or newer (`nvm use` reads `.nvmrc`), PostgreSQL running locally, and Git.

Create the database user and two databases once, as a Postgres superuser (for example `psql -U postgres`). Skip
the first line if the `bh` role already exists:

```sql
CREATE ROLE bh WITH LOGIN PASSWORD 'bh';
CREATE DATABASE hld OWNER bh;
CREATE DATABASE hld_test OWNER bh;
```

Then:

```sh
npm run setup    # once: installs, creates .env, creates the tables in both databases
npm run dev      # API on :3000, web on :5173
```

Open <http://localhost:5173>. If your Postgres uses another port, user or password, edit `.env`.

## Commands

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `npm run setup`    | install, create `.env`, create tables in both databases |
| `npm run dev`      | API and web together                                    |
| `npm run check`    | typecheck, lint, tests                                  |
| `npm run db:reset` | drop and recreate the tables                            |
| `npm run format`   | Prettier                                                |

## Architecture

```
apps/web     React, Vite, Tailwind, TanStack Query. Every screen gets its data from the API.
   │  JSON over /api, checked on both sides with the zod schemas in packages/shared
   ▼
apps/api     Express 5 + TypeScript:  route → controller → service → logic → repository
                                                            │         │          │
                    catalog: the 8 data files, in memory ◄──┘         │          └─► Postgres (Prisma)
                    builder, validator, changes, quick request ◄──────┘              packages, reservations, stock
```

- **Three workspaces:** `apps/api`, `apps/web`, and `packages/shared` (the request and response contracts and the
  shared trip format, used by both sides). The rules, prices and choices all run in the backend.
- **Layers, checked by ESLint:** routes and controllers deal with HTTP, services run one use case, `*.logic.ts` files
  are pure functions (no database, no clock, so they are easy to test), and repositories are the only code that
  touches Prisma.
- **Catalog:** the 8 data files are read once at startup, checked record by record against `DATA_DICTIONARY.md`, and
  indexed in memory. They are never written.
- **Postgres** keeps what must survive a restart: `Package` (the request and the package), `Reservation` (the 10-digit
  number and the booked snapshot), and `FlightStock` / `RoomStock` (seats and rooms that bookings used up, S2).
- **One shape for a package:** it is saved, shown and exported in the shared trip format (`DATA_DICTIONARY.md` §4), so
  the JSON export is exactly the saved package.
- **Two independent checks:** the builder makes packages; a separate validator, written from the rules text and not
  from the builder, checks the 12 rules of §4. It runs after every change, before confirm and before export, and its
  verdict is shown in the rules panel.
- **More detail:** [ARCHITECTURE.md](ARCHITECTURE.md) (how a package is built and changed, step by step) and
  [docs/SOLUTION.md](docs/SOLUTION.md) (each decision and what was built).

## Our city rule

The builder tries every plan: any list of distinct cities in the country, each linked to the next, with at least 2 nights in each, adding up to the trip. Each plan is priced city by city, because a choice in one city never changes another. The cheapest plan within budget wins. On a tie, fewer cities win, then the plan that reaches its first hotel sooner, then a fixed order. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## What we finished

Every Must, every Good to have, and every Should.

| #  | Feature | What it does |
| -- | ------- | ------------ |
| M1 | Request form | The 7 fields, with cities and countries from `destinations.json`. A value that isn't valid gets a clear message on its field. |
| M2 | Build one package | Chooses the city plan and builds the whole package. When none is possible, says why (for example no flight lands on that day). |
| M3 | Rules respected | Every §4 rule holds. Checked by the validator and by separate scripts over thousands of packages (see Proof in `docs/SOLUTION.md`). |
| M4 | Day-by-day plan | Each day in time order, in local time, with the overnight departure made clear. |
| M5 | Total and budget, export | Total, budget and the amount left or over. "Download as JSON" in the shared trip format; after confirm it is the booked snapshot. |
| M6 | Change the package | Change a city's hotel, the arrival or return flight, add or remove visits. Each choice shows the new total or why it can't be used. A change that breaks a rule is refused with every reason, and nothing is saved. |
| M7 | Confirm | A unique 10-digit reservation number and a summary that opens from the number, also after a restart. A wrong number shows "not found". |
| M8 | Budget too small | Says so, shows the cheapest package and its total, and the budget that would cover it. |
| G1 | Changes that affect other parts | A change re-picks the transfers it affects and gives a new visit the earliest free time. What it can't fix is refused with the reason. |
| G2 | Price difference | Every hotel, flight and visit choice shows its difference against the current total. |
| G3 | Change cities | Lists every valid city plan with its cheapest total, or why it can't be built, and builds the package again for the plan picked. |
| G4 | Three packages | The cheapest, the fastest and the best rated, each within budget, each one exact (not a re-sort of the cheapest). |
| S1 | Quick request | "Describe your trip": reads plain words with rules (no AI) and fills only what the text says. Anything that could mean two things is left for the traveler, with a note. |
| S2 | Seats and rooms run out | Confirming uses up seats and rooms in our own store, in one transaction. A booking that needs what is already taken is refused, and new packages never offer it. |
| S3 | Our own idea | The rules panel: the validator's verdict on the package, rule by rule, right on the package page. Also free-time suggestions on the arrival and city-change days. |

## Known limitations

- **The three packages (G4) live in the browser's history.** They survive a refresh, but a package link opened fresh
  shows only that package.
- **A confirmed holiday can't be changed or cancelled.** To change one, build a new package. So seats and rooms a
  booking used up (S2) are never given back.
- **The first package keeps the optional parts out:** no visits on the arrival and city-change days and no station
  taxis, as §4 allows. The traveler can add visits on those days, and the taxi comes with them.
- **The quick request (S1) reads English and the phrasings it was written for.** Anything else stays empty for the
  traveler to fill; it never guesses.
- **The catalog is kept in memory**, which suits data of this size. A much larger catalog would need its own tables.
- **No sign-in.** Anyone with a package link or a reservation number can open it. Numbers are random, so they can't be
  guessed in order.
