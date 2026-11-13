# Architecture

How the app is put together, and how it builds a package. Decisions and their reasons are in `docs/SOLUTION.md`.

## The parts

```
Browser (React)
   │  POST /api/packages  { the 7 request fields }
   ▼
API (Express): route → controller → service → logic → repository
   │                          │            │
   │                          │            └─ Postgres: packages and reservations only
   │                          └─ builder (pure functions) ──reads──► catalog in memory
   ▼
{ data: OK | OVER_BUDGET | NO_PACKAGE }
```

- **Catalog:** the 8 data files, read once at startup, checked against `DATA_DICTIONARY.md` and indexed in memory (`apps/api/src/modules/catalog`). It's never written. Why it's in memory: decision record 0012, outside the repo.
- **Builder:** pure functions. The request and the catalog go in, a package comes out. No database, no clock.
- **Postgres:** keeps what must survive a restart: packages and confirmed reservations.
- **The package:** stored, sent to the screens and exported in one shape, the shared trip format (`DATA_DICTIONARY.md` §4). It lives in `packages/shared/src/holiday-package.ts`.

## Building a package, v1 (one city)

v1 builds packages that stay in one city. v2 adds plans with several cities (see the end of this section).

### Words used below

| Word           | Meaning                                                         | Menon example        |
| -------------- | --------------------------------------------------------------- | -------------------- |
| Start date `S` | The day the arrival flight lands (local time)                   | Sat 10 Apr           |
| Last day `L`   | `S` + nights. The return flight leaves that day. No hotel night | Fri 16 Apr           |
| Hotel nights   | `S` up to the day before `L`                                    | 10–15 Apr (6 nights) |
| Full days      | Every day after the arrival day and before the last day         | 11–15 Apr            |
| Travelers `T`  | Adults + children. Every child needs a seat                     | 3                    |

The numbers in the travel rules (60 and 180 minutes, the 09:00 start of a full day) live in `apps/api/src/modules/holiday-packages/logic/travel-rules.ts`. The builder is `builder.logic.ts` next to it, both in `holiday-packages/logic/`.

### Step 1: check the request

The shape (types, formats) is checked by `holidayRequestSchema`. Then the values are checked against `destinations.json`:

- the departure airport and the country exist;
- nights are within `rules.min_nights` to `rules.max_nights`;
- `S` is on or after `rules.data_window.first_night`, and `L` is on or before `rules.data_window.last_departure`.

Each failure is a message on its field (400 `VALIDATION_ERROR`). No limit is written in the code.

### Step 2: list the city plans

In v1, each city of the country is one plan, with all the nights. One city always meets "at least 2 nights per city", because a trip has at least 3 nights.

### Step 3: find the cheapest valid package for each city

**a. Flights.**

- **Arrival:** from the departure airport, landing on `S` (local) at an airport whose `serves_cities` includes the city, with `seats_left ≥ T`.
- **Return:** leaving on `L` (local) from an airport serving the city, to the departure airport, with `seats_left ≥ T`.
- Arrival and return airports may differ.

**b. Hotel rooms.** For every room type in the city's hotels:

- **The fewest rooms `k` that fit:** `k = max(⌈adults ÷ max_adults⌉, ⌈travelers ÷ (max_adults + max_children)⌉)`. The room type fits only if `k ≤ adults`. Within one room type, the smallest `k` is always best, because both the price and the rooms needed grow with `k`.
- **Free on every night:** `rooms_left ≥ k` on every hotel night. A missing night counts as 0.
- **Price:** `price_per_night × k × nights`.

**c. Airport transfers.** They must match the flight's airport, the city, and the hotel's area (`area: null` serves every area). Transfers run in both directions.

- **Arriving:**
  - The pickup is the **earliest** time at or after landing + 60 min that falls inside the service hours: landing + 60 itself, or the opening time if that's later.
  - A window that runs past midnight (`06:00`–`00:30`) also covers the first minutes after midnight. `24:00` is the end of the day.
  - The traveler reaches the hotel at pickup + `duration_minutes`.
- **Leaving:**
  - The latest allowed departure from the hotel is the flight's departure − 180 min − `duration_minutes`.
  - The traveler leaves at the **latest** time no later than that which is inside the service hours, on the last day itself.
  - If no such time exists, that flight doesn't work with that hotel.

**d. Combine.**

- For each room option, take the cheapest arrival flight + its transfer, and the cheapest return flight + its transfer. One city has one hotel, so the two halves don't affect each other, and taking the best of each is exact.
- The city's best is the cheapest room + arrival half + return half.
- On a tie, the earlier record in the catalog wins, so results repeat.

**e. Attractions: one on each full day.**

- **What's possible:**
  - An attraction can go on a day if it is in the city, open that weekday (`open_days`), and not on a `closed_dates` date.
  - The visit starts at 09:00, or at opening time if that's later. It must end by `open_until`.
  - None on the arrival day (optional, left empty) and none on the last day (not allowed).
- **How they're picked:**
  - Each full day needs a different attraction, at the lowest total price. That's the **assignment problem**: days × attractions, the cost is the price, and the pair is forbidden where the attraction can't go that day.
  - It's solved exactly with the **Hungarian algorithm** (`logic/attractions.logic.ts`), in O(days² × attractions). A city has at most about 15 attractions, so that's instant.
  - Picking day by day fails. If day 1 takes the free attraction that day 2 also needs, day 2 gets nothing or pays more. In tests on the real data, a day-by-day pick overpaid by up to ₹1,120: on Monday 12 Apr most free attractions are closed.
  - On equal price, the attraction listed first in the catalog wins.
- **No match:** if some full day can't get an attraction, the city fails.

**f. Prices.** All whole INR.

| Part                    | Price                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Flight                  | `price_per_seat × T` (children pay the same)                                           |
| Hotel                   | `price_per_night × k × nights`                                                         |
| Transfer, `PER_PERSON`  | `adults × price + children × (child_price, or price if missing)`                       |
| Transfer, `PER_VEHICLE` | `price × ⌈T ÷ max_passengers⌉`                                                         |
| Attraction              | `adults × price_per_person + children × (child_price, or price_per_person if missing)` |

The total is the sum of the parts.

### Step 4: choose

- **At least one city is within budget** (total ≤ budget): the cheapest wins → `OK`.
- **Cities work, but none is within budget:** the cheapest wins, labelled → `OVER_BUDGET`. It's still saved and can be confirmed.
- **No city works** → `NO_PACKAGE` (step 5).

### Step 5: when no package is possible, say why

Each city stops at the first step it fails. The answer is the reason from the city that got furthest, in the traveler's words:

| Stopped at       | Code                | Message, for example                                                                                                                                             |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrival flight   | `NO_ARRIVAL_FLIGHT` | "No flight from Chennai lands in Japan on 10 Apr 2027."                                                                                                          |
|                  | `NO_ARRIVAL_SEATS`  | "No flight from Delhi landing in Japan on 1 Apr 2027 has 5 seats left."                                                                                          |
| Return flight    | `NO_RETURN_FLIGHT`  | "No flight back to Mumbai leaves Japan on 4 Apr 2027."                                                                                                           |
|                  | `NO_RETURN_SEATS`   | The same, when flights exist without enough seats                                                                                                                |
|                  | `NO_COMMON_CITY`    | "On 2 Apr 2027 flights land only at NRT, and on 5 Apr 2027 flights back leave only from KIX. No city is served by both." (v1 only: v2 can go through two cities) |
| Hotel room       | `NO_ROOM`           | "No hotel in Osaka has rooms for 2 adults and 1 child free on every night."                                                                                      |
| Airport transfer | `NO_TRANSFER`       | "No airport transfer in Osaka runs at the times these flights need."                                                                                             |
| Attractions      | `NO_ATTRACTIONS`    | "Not enough different attractions are open in Osaka to fill every full day."                                                                                     |

### Step 6: write the package

The package is written in the trip format, in **journey order**:

1. arrival flight;
2. transfer to the hotel;
3. hotel (`start` = check-in date, `end` = check-out date, `room_id`, `quantity` = `k`);
4. attractions by date;
5. transfer to the airport;
6. return flight.

The items are written in that order rather than sorted, because a hotel's date-only `start` would sort before the same day's times.

Times are local, without seconds (`YYYY-MM-DDTHH:MM`). A flight's `city` is where it lands. Every item is `PLANNED`.

### How big the search is

Per city: room types × (arrival flights + return flights) × transfers, which is a few thousand checks. The builder answers 864 requests in about 80 ms (13 Nov). The requests covered every departure city, both countries, every start date and trip length, with 2 adults and 1 child.

### Worked example: Menon

This is what v1 returns. Checked by running this logic on the catalog on 13 Nov.

| Part        | Choice                                                           | ₹            |
| ----------- | ---------------------------------------------------------------- | ------------ |
| City        | Tokyo                                                            |              |
| Arrival     | `FL-401` BLR 23:50 (9 Apr) → NRT 10:30, 3 seats                  | 75,600       |
| Transfer    | Narita bus to Ueno, pickup 11:30                                 | 4,480        |
| Hotel       | Ueno Garden Inn, Family Room (`RM-TYO-004-B`), 1 room × 6 nights | 56,784       |
| Attractions | One free attraction each day, 11–15 Apr                          | 0            |
| Transfer    | Haneda bus from Ueno, leaving 07:05 on 16 Apr                    | 1,820        |
| Return      | `FL-412` HND 11:00 → BLR                                         | 80,640       |
| **Total**   | Budget ₹3,50,000, ₹1,30,676 left                                 | **2,19,324** |

Why these won:

- **Tokyo** wins on flights: ₹1,56,240, against ₹1,81,440 for Osaka or Kyoto through `KIX`.
- **`FL-403`** is cheaper per seat but has only 2 seats left.
- **`FL-405`** is ₹3,780 cheaper for 3 seats, but it lands at 21:30. The bus stops at 22:00 and the pickup can't be before 22:30, so it needs a taxi costing ₹8,400 more.

### What v1 can't do yet

The same 864-request run, with 2 adults and 1 child and no budget limit:

- **Every request worked:** from Bengaluru to Japan, and from every city to the UAE.
- **From Mumbai, Delhi and Chennai to Japan:**
  - 136 requests have no flight at one end. No version can build those, so "no package" is correct.
  - **77 more have flights at both ends, at airports that serve no city in common** (for example, landing at `KIX` and leaving from `NRT` or `HND`). v1 says "no package". A plan with two cities, such as Osaka then Tokyo, may serve them. That's v2.

### v2: plans with several cities

- **The plans:** every order of distinct cities in the country, each linked to the next (`links` in `destinations.json`), at least `min_nights_per_city` nights each, adding up to the trip. That's 27 plans for 6 nights in Japan.
- The arrival flight serves the first city, and the return flight serves the last city.
- Each city gets its own hotel and its own attractions on its full days.
- **On a city-change day**, the transfer between the cities leaves at the first departure at or after 10:00 on its timetable (first departure + whole steps of `frequency_minutes`), inside the service hours.
- **When the traveler reaches the new hotel:**
  - by train or bus: the arrival time at the station, plus that city's station taxi time;
  - by door-to-door taxi: its arrival time.
- **Choosing:** the same as step 4. On a tie, fewer city changes wins.
