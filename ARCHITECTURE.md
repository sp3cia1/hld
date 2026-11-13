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

## Building a package

The builder tries every plan of one, two or three cities and keeps the cheapest valid package.

### Words used below

| Word           | Meaning                                                         | Menon example        |
| -------------- | --------------------------------------------------------------- | -------------------- |
| Start date `S` | The day the arrival flight lands (local time)                   | Sat 10 Apr           |
| Last day `L`   | `S` + nights. The return flight leaves that day. No hotel night | Fri 16 Apr           |
| Hotel nights   | `S` up to the day before `L`                                    | 10–15 Apr (6 nights) |
| Full days      | Every day after the arrival day and before the last day         | 11–15 Apr            |
| Travelers `T`  | Adults + children. Every child needs a seat                     | 3                    |

The numbers in the travel rules (60 and 180 minutes, the 09:00 start of a full day, the 10:00 city-change departure) live in `apps/api/src/modules/holiday-packages/logic/travel-rules.ts`. The plans are listed by `plans.logic.ts` and the builder is `builder.logic.ts`, next to it in `holiday-packages/logic/`.

### Step 1: check the request

The shape (types, formats) is checked by `holidayRequestSchema`. Then the values are checked against `destinations.json`:

- the departure airport and the country exist;
- nights are within `rules.min_nights` to `rules.max_nights`;
- `S` is on or after `rules.data_window.first_night`, and `L` is on or before `rules.data_window.last_departure`.

Each failure is a message on its field (400 `VALIDATION_ERROR`). No limit is written in the code.

### Step 2: list the city plans

`plans.logic.ts` lists the plans. A plan is a list of distinct cities from `destinations.json`, each used once and each linked (`links`) to the next, with at least `min_nights_per_city` nights in each, adding up to the trip. For 6 nights in Japan that is 27 plans (3 with one city, 18 with two, 6 with three). A 10-night trip has 135, and the UAE has at most 16. A one-city plan always exists, because a trip has at least 3 nights.

### Step 3: find the cheapest valid package for each plan

**a. Flights.**

- **Arrival:** from the departure airport, landing on `S` (local) at an airport whose `serves_cities` includes the **first** city of the plan, with `seats_left ≥ T`.
- **Return:** leaving on `L` (local) from an airport serving the **last** city of the plan, to the departure airport, with `seats_left ≥ T`.
- Arrival and return airports may differ.

**b. Hotel rooms.** Each city is priced on its own nights. For every room type in the city's hotels:

- **The fewest rooms `k` that fit:** `k = max(⌈adults ÷ max_adults⌉, ⌈travelers ÷ (max_adults + max_children)⌉)`. The room type fits only if `k ≤ adults`. Within one room type, the smallest `k` is always best, because both the price and the rooms needed grow with `k`.
- **Free on every night:** `rooms_left ≥ k` on every one of the city's nights. A missing night counts as 0.
- **Price:** `price_per_night × k × the city's nights`.

**c. Airport transfers.** They apply in the first city (arriving) and the last city (leaving) only. They must match the flight's airport, the city, and the hotel's area (`area: null` serves every area). Transfers run in both directions.

- **Arriving:**
  - The pickup is the **earliest** time at or after landing + 60 min that falls inside the service hours: landing + 60 itself, or the opening time if that's later.
  - A window that runs past midnight (`06:00`–`00:30`) also covers the first minutes after midnight. `24:00` is the end of the day.
  - The traveler reaches the hotel at pickup + `duration_minutes`.
- **Leaving:**
  - The latest allowed departure from the hotel is the flight's departure − 180 min − `duration_minutes`.
  - The traveler leaves at the **latest** time no later than that which is inside the service hours, on the last day itself.
  - If no such time exists, that flight doesn't work with that hotel.

**d. Combine, city by city.**

- No choice in one city changes another. A hotel affects only its own city's price, and only the first city's hotel affects the arrival transfer and only the last city's hotel affects the return transfer. So the cheapest choice per city, added up, is exact.
- In the first city, for each room option, take the cheapest arrival flight + its transfer. In the last city, do the same for the return flight. A plan with one city does both in the same hotel. Middle cities need only a room.
- The plan's best is the sum of its cities' cheapest options and the moves between them.
- On a tie, the earlier record in the catalog wins, so results repeat.

**Between cities.** The move from one city to the next leaves on the change day, from the timetable in `destinations.json`:

- **Train or bus:** the first departure at or after 10:00 (`HOPS_LEAVE_AT`): `service_from` plus whole steps of `frequency_minutes`. If the service stops earlier than that, the last departure of the day.
- **Taxi:** any time, so it leaves at 10:00.
- **Choosing:** the cheapest move, then the one that arrives sooner.
- **Reaching the new hotel:** by train or bus, the arrival time at the station plus that city's station taxi time; by door-to-door taxi, its arrival time.

**e. Attractions: one on each full day of each city.**

- **What's possible:**
  - An attraction can go on a day if it is in that day's city, open that weekday (`open_days`), and not on a `closed_dates` date.
  - The visit starts at 09:00, or at opening time if that's later. It must end by `open_until`.
  - None on the arrival day or on a change day (optional, left empty; the package page lists what still fits that day instead, from
    `logic/free-time.logic.ts`) and none on the last day (not allowed).
- **How they're picked:**
  - Each city's full days need different attractions, at the lowest total price. That's the **assignment problem**: days × attractions, the cost is the price, and the pair is forbidden where the attraction can't go that day.
  - It's solved exactly with the **Hungarian algorithm** (`logic/attractions.logic.ts`), in O(days² × attractions). A city has at most about 15 attractions, so that's instant.
  - Picking day by day fails. If day 1 takes the free attraction that day 2 also needs, day 2 gets nothing or pays more. In tests on the real data, a day-by-day pick overpaid by up to ₹1,120: on Monday 12 Apr most free attractions are closed.
  - On equal price, the attraction listed first in the catalog wins.
- **No match:** if some full day can't get an attraction, the plan fails.

**f. Prices.** All whole INR.

| Part                    | Price                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Flight                  | `price_per_seat × T` (children pay the same)                                           |
| Hotel                   | `price_per_night × k × the city's nights`                                              |
| Transfer, `PER_PERSON`  | `adults × price + children × (child_price, or price if missing)`                       |
| Transfer, `PER_VEHICLE` | `price × ⌈T ÷ max_passengers⌉`                                                         |
| City change             | The timetable price, `PER_PERSON` or `PER_VEHICLE`, as for a transfer                  |
| Attraction              | `adults × price_per_person + children × (child_price, or price_per_person if missing)` |

The total is the sum of the parts.

### Step 4: choose

- **At least one plan is within budget** (total ≤ budget): the cheapest wins → `OK`.
- **Plans work, but none is within budget:** the cheapest wins, labelled → `OVER_BUDGET`. It's still saved and can be confirmed.
- **No plan works** → `NO_PACKAGE` (step 5).
- **On a tie:** fewer cities, then the plan that reaches its first hotel sooner, then plan order. Example: BLR, 7 Apr, 9 nights. Osaka 5 > Kyoto 4 and Kyoto 4 > Osaka 5 both cost ₹2,57,110. Osaka first wins, because the hotel is reached at 12:20 against 13:00.

### Step 5: when no package is possible, say why

Each plan stops at the first step it fails. The answer is the reason from the plan that got furthest, in the traveler's words:

| Stopped at       | Code                | Message, for example                                                         |
| ---------------- | ------------------- | ---------------------------------------------------------------------------- |
| Arrival flight   | `NO_ARRIVAL_FLIGHT` | "No flight from Chennai lands in Japan on 10 Apr 2027."                      |
|                  | `NO_ARRIVAL_SEATS`  | "No flight from Delhi landing in Japan on 1 Apr 2027 has 5 seats left."      |
| Return flight    | `NO_RETURN_FLIGHT`  | "No flight back to Mumbai leaves Japan on 4 Apr 2027."                       |
|                  | `NO_RETURN_SEATS`   | The same, when flights exist without enough seats                            |
|                  |                     | `NO_COMMON_CITY`                                                             | "On 2 Apr 2027 flights land only at NRT, and on 5 Apr 2027 flights back leave only from KIX. No city is served by both, and 3 nights is too short for two cities: each needs at least 2." |
| Hotel room       | `NO_ROOM`           | "No hotel in Osaka has rooms for 2 adults and 1 child free on every night."  |
| Airport transfer | `NO_TRANSFER`       | "No airport transfer in Osaka runs at the times these flights need."         |
| Attractions      | `NO_ATTRACTIONS`    | "Not enough different attractions are open in Osaka to fill every full day." |

### Step 6: write the package

The package is written in the trip format, in **journey order**:

1. arrival flight;
2. transfer to the hotel;
3. for each city in turn: the move from the previous city (not for the first city), the hotel (`start` = check-in date, `end` = check-out date, `room_id`, `quantity` = `k`), then its attractions by date;
4. transfer to the airport;
5. return flight.

The items are written in that order rather than sorted, because a hotel's date-only `start` would sort before the same day's times.

Times are local, without seconds (`YYYY-MM-DDTHH:MM`). A flight's `city` is where it lands, and a move between cities has the city it arrives in. Every item is `PLANNED`.

### How big the search is

For Menon, over the 27 plans:

| Way of searching                                   | Work                                                  |
| -------------------------------------------------- | ----------------------------------------------------- |
| Every combination of hotels, flights and transfers | 6,990,380 packages                                    |
| City by city (what the builder does)               | 1,401 room options + 3,296 flight-and-transfer checks |
| One city only                                      | 69 room options + 344 checks                          |

City by city is about 1,500× less work than every combination, for the same answer. The builder answers the 864 test requests in about 0.6 s (under 1 ms each). One city alone took 62 ms. The requests covered every departure city, both countries, every start date and trip length, with 2 adults and 1 child.

### Worked example: Menon

Checked by running this logic on the catalog. The best plan is still one city.

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
- **Tokyo 2 > Osaka 4** is ₹2,30,440. It saves ₹7,392 on hotels and ₹2,520 on the flight, but the Shinkansen costs ₹20,608.

### Worked example: Delhi, 1 Apr, 5 nights

The best plan is **Tokyo 2 > Osaka 3**: the Shinkansen leaves at 10:00 on 3 Apr, and the total is ₹2,83,060.

### What several cities change

The same 864-request run, with 2 adults and 1 child and no budget limit, against the builder with one city only:

- **61 more requests get a package** (712 against 651). Their flights land at and leave from airports that serve no city in common (for example, landing at `KIX` and leaving from `NRT`), so only a plan with two cities can serve them.
- **16 still don't, all 3-night trips.** Three nights is too short for two cities.
- **345 packages use two or three cities.**
- **284 are cheaper than one city.** The median saving is ₹5,530 in Japan and ₹10,099 in the UAE.

## Changing a package (M6)

The traveler changes one part at a time: the hotel of one city, the arrival flight or the return flight. Every change
runs one path, in `apps/api/src/modules/package-changes`:

```
POST /api/packages/:id/changes   { type: 'hotel', city, hotelId, roomId } | { type: 'flight', direction, flightId }
   │
   ▼
service: load the trip and its updatedAt → 409 PACKAGE_CONFIRMED if BOOKED → 400 if it can't be tried (checkChange)
   │
   ▼
tryChange (pure, change.logic.ts), on a copy:
   1. swap the one item, written as the builder writes it (logic/trip-items.logic.ts); it keeps its item_id and place
   2. a flight: any `flights` problem the validator finds on it (airport, day, home) → REFUSED now
   3. pick again the airport transfers the item affects, with the builder's own functions (logic/airport-transfers.logic.ts)
        the first city's hotel, or the arrival flight → the transfer from the airport
        the last city's hotel, or the return flight   → the transfer to the airport (a one-city trip: both)
      none runs then → REFUSED: "No airport transfer from NRT reaches Asakusa after the 22:50 landing"
   4. total_inr = the sum of the items, then validateTrip on the whole package → any problem: REFUSED
   │
   ▼
service: save only if updatedAt is unchanged (else 409 PACKAGE_CHANGED) → APPLIED, with the package as GET returns it
```

- **What the app repairs:** only the airport transfers. The app decides how and when, never what (decision record
  0011, outside the repo): flights, hotels, visits, the cities and the moves between cities are never touched.
- **Why the total is set before the validator runs:** the validator's prices rule checks that `total_inr` is the sum
  of the items, so the copy's total must already be right.
- **Over budget never refuses a change.** `toSavedPackage` labels the result `OVER_BUDGET` when the total is above
  the budget, for a built, a loaded or a changed package alike.
- **REFUSED is a 200,** like `NO_PACKAGE`: a valid answer to a valid request. A change needs no `Idempotency-Key`,
  because it sets a value ("this hotel"): sending it twice gives the same package.

### Adding and removing visits

The traveler picks the attraction and the day; the app picks the start time and, when needed, the taxi from the
station (0011). Both run through `tryChange`, so the validator checks the whole package as for hotels and flights.

- **`add_attraction`** `{ date, attractionId }`, on any day from the start date up to the day before the last (400
  otherwise):
  1. Refused at once, in the traveler's words, when the attraction is in another city than that night's hotel, is
     already in the plan, or is closed that weekday or that date.
  2. **The day begins** at 09:00 (`VISITS_START_AT`) on a full day, and when the family reaches the hotel on the
     arrival day and a change day (`arrivalsIn` in `logic/free-time.logic.ts`, the same times as the free-time list).
  3. **The start** is the first that fits of: the start of the day, then the end of each visit already that day. It
     must be inside the opening hours with the whole visit (`earliestVisit` in `logic/attractions.logic.ts`) and clear
     of every other visit. None fits: "No time left on 11 Apr 2027: Tokyo Disneyland needs 480 minutes before it
     closes at 21:00".
  4. **On a change day by train or bus** with no station taxi yet, the city's `CITY_TAXI` goes in right after the
     train, picked up at the earliest time at or after the train arrives.
  5. The visit goes in journey order: after the day's transfers and hotel, among that day's visits by start time. New
     items take the next unused id (`i11`, `i12`…); no other item is renumbered.
- **`remove_attraction`** `{ itemId }`: the last visit of a full day is refused ("Every full day keeps at least one
  visit: add another first, then remove this one"). The last visit of a change day takes the station taxi with it.
- **Choices for a day** (`GET …/choices/attraction?date=…`): every attraction of that night's city, each previewed
  with a dry run (READY with its start time, or BLOCKED with the reason). The country's other cities are counted in
  `hidden`.

Example, Menon on Sun 11 Apr (Senso-ji 09:00–10:00): teamLab Planets starts at 10:00, for +₹5,096 (2 × ₹2,128 + ₹840).
Tsukiji Outer Market is blocked, "closed on Sundays". Delhi, 1 Apr, 5 nights, on the 3 Apr move to Osaka (Shinkansen
arrives 12:30): a visit adds the Osaka taxi from the station at 12:30 (₹1,232) and starts at 12:50.

### The choice lists and the dry run

`GET /api/packages/:id/choices/hotel?city=…` and `GET /api/packages/:id/choices/flight?direction=arrival|return`
(`choices.logic.ts`) list what the traveler can pick (decision record 0013, outside the repo):

- **Hidden, and counted:** only what can never work for this party on these dates. A room type that no number of rooms
  fits (the room-fit rule finds no `k`), and a flight with fewer seats left than travelers.
- **Listed:** everything else. For a hotel, every room type of every hotel in that city, for that city's nights. For a
  flight, every flight from home that lands on the start date (or flies home on the last day) at any airport of the
  country, not only those serving the current first or last city.
- **Each preview is a dry run:** `tryChange` without the save, the very function POST runs. READY carries the new
  total and the difference; BLOCKED the first problem's message. A preview can't disagree with the result, because it
  is the result. One validator pass per choice: Menon's 31 Tokyo hotel previews take 0.6 ms in all.
- **Order:** the current choice, then READY by difference, then BLOCKED. Ties keep the catalog's order.

Worked example, Menon (`FL-401` lands at `NRT` at 10:30, Ueno Garden Inn, the Narita bus to Ueno):

| Choice                           | Preview        | Why                                                                                                                       |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `FL-405`, lands at `NRT` 21:30   | READY, +₹4,620 | ₹3,780 less for 3 seats, but the pickup can't be before 22:30 and the bus to Ueno stops at 22:00, so the taxi: +₹8,400    |
| `FL-740`, lands at `KIX`         | BLOCKED        | "KIX doesn't serve Tokyo, the first city"                                                                                 |
| `FL-403`                         | hidden         | 2 seats left for 3 travelers                                                                                              |
| Asakusa River Hotel, Family Room | READY, +₹5,712 | The room costs ₹5,712 more. Both airport transfers are picked again for Asakusa, and those buses cost the same as to Ueno |
| Ginza Pearl Hotel, Family Room   | BLOCKED        | "Only 0 Family Room left on the night of 2027-04-12, and 1 are needed"                                                    |
