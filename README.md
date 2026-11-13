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

To write.

## Our city rule

The builder tries every plan: any list of distinct cities in the country, each linked to the next, with at least 2 nights in each, adding up to the trip. Each plan is priced city by city, because a choice in one city never changes another. The cheapest plan within budget wins. On a tie, fewer cities win, then the plan that reaches its first hotel sooner, then a fixed order. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## What we finished

To write.

## Known limitations

To write.
