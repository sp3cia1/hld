# Slop answers

Word-for-word answers from tools given the plain prompt (statement + dataset README, no hints). Everything they share is table stakes.

## Claude (fresh agent, no context, no tools), 13 Nov

# Build My Holiday: build plan, demo, and pitch for a 2-person, 9-hour hackathon

## Short version

- **Stack:** TypeScript on both ends. A Node backend (Fastify or Express), a React + Vite frontend, and SQLite (`better-sqlite3`) for storage. One shared `types` folder holds the trip format. Start it with `npm install && npm run dev`, which uses `concurrently` to run both.
- **Core design:** two functions that don't depend on each other.

  - `build(request) → package` searches for a package.
  - `validate(package) → violations[]` checks every rule in section 4.

  The API never returns a package or accepts a change until `validate` comes back empty. That one design choice covers M3, M6, G1 and most of the "correctness on judge requests" score.
- **Search approach:** the search space is small (at most 10 nights, a handful of cities, 20 days of data). So list every valid city plan, choose flights for each plan, then fill hotels, transfers and attractions greedily. That's brute force with pruning. Don't use clever optimisation.
- **Demo hook:** a live **rule checklist** on screen that turns green after every change. The judges score correctness, so show them correctness.
- **Pitch:** *"Change anything. It stays bookable."*

## Step 0 (first 45 minutes, both of you)

1. Read `DATA_DICTIONARY.md` section 4 first; make the internal package model match the export format plus display fields.
2. Profile the data with a quick script (cities per country, null `child_price`, flight date spread, service hours crossing midnight, one-stop flights, hotel `area`, `closed_dates`).
3. Ask the help desk early: what "reaches the city" means on a change day; whether attractions need travel time between them; whether a 0-year-old needs a seat.
4. Scaffold, push, commit hourly with real messages.

## Backend architecture

catalog/ (load JSON once, indexes) · engine/ plans.ts, flights.ts, hotels.ts, transfers.ts, attractions.ts, builder.ts (collects failure reasons), validator.ts (every rule with ID + message), pricing.ts, rules.config.ts (60, 180, 3–10 nights, date window as constants) · api/ · db/ SQLite: packages, reservations, inventory_used · web/ React.

Magic numbers in `rules.config.ts` so the live code change ("make the buffer 120 minutes") is a one-line edit.

Indexes: flights by (origin, arrival local date) and (departure local date, destination); airports by served city; availability by (room_id, night); transfers by type and (from_city, to_city); attractions by city.

### Builder algorithm

Hotel nights = start … start+nights−1; last day = start+nights.

1. City plans: ordered distinct cities, ≥2 nights each, sum N, adjacent pairs linked; prune by first city having an arrival flight landing on start and last city a return flight on the last day.
2. Flights: filter arrival by arrival local date; seats ≥ travelers; durations via UTC with luxon.
3. Airport transfers: pickup ≥ 60 min after landing, in service hours, serving city and area; return: leave hotel = departure − 180 − duration, inside service hours, else try another flight. One `fitsServiceHours` helper handling midnight-crossing windows.
4. Hotels: for each room type try every k from min to adults; rooms_left ≥ k every night; keep cheapest and highest-star.
5. Inter-city transfer in service hours; its arrival = "reaches the city".
6. Attractions greedy per day: full day from ~09:00, arrival/change day after arrival, none on last day; filter by city, weekday, closed dates, opening hours, overlap, used; 1–2 per full day or plan invalid; cheapest first.
7. Price with pricing.ts, pick cheapest within budget, run validate() before returning.
   Pricing traps: PER_VEHICLE counts children; missing child_price → adult price; integer rupees.

### Failure reasons (M2) / budget (M8)

Count where each plan died; report the dominant stage in plain words (e.g. "No flight from DEL lands in the UAE on 21 April. Flights exist only from 1 to 20 April."). Budget too small: show cheapest, the gap, and tested suggestions by re-running with one fewer night, start ±1–2 days, the other country ("Shorten to 5 nights → ₹3,12,400 (fits)").

### Input validation (M1)

Departure/country from destinations; nights 3–10; start ≥ 1 Apr; start+nights ≤ 20 Apr; ≥1 adult; child ages integers 0–17; budget > 0; one message per check.

### Changes (M6, G1, G2)

Option endpoints (hotel, flights, attractions per day) with Δ price. POST changes: apply to a copy, repair dependents, validate, save or refuse with violations. Flight change re-picks airport transfer and drops clashing day-1 attractions with warnings[]; hotel change re-picks transfer (area); add attraction refused on overlap/duplicate/closed; remove always allowed (1–2 rule only for the first package).

### Persistence (M7, S2)

Tables packages, reservations(ref TEXT PK, snapshot_json), inventory_used. Ref = 10 random digits, non-zero first digit, retry on collision. Snapshot on confirm with status BOOKED. S2: effective availability = catalog − inventory_used, checked and decremented in one transaction.

### G4 / G3

Three rankings over the enumerated plans (cheapest, fastest via UTC durations + inter-city, best rated stars per night within budget). G3: list plans, pick one, rebuild.

## Fuzz test

~300 random requests across countries, departure cities, dates, 1–4 adults, children 0–17, budgets; build, export, validate, check total = sum of parts. Have the person who did not write the builder write the validator.

## Frontend

Form with dropdowns from API, child-age chips, inline errors. Package page: city-plan strip, day-by-day timeline, budget bar, rule checklist panel, Change buttons with ±₹ options, Export and Confirm. Reservation page /r/:ref with "Reservation not found". Images optional with attribution footer.

## Split and timeline

A = engine (catalog, plans, flights, transfers, hotels → attractions, failure reasons, M8 → changes, repair, deltas → G4/G3). B = validator, pricing, input validation, SQLite, API → form, timeline, budget bar, export → change UI, confirm, reservation page → S2, S1. Both: fuzz + Menon and UAE dry runs at 6:30–7:30; README + rehearsal at the end. Pace check: Menon clean by ~5:00 or drop stretch. 15-min code swap at ~7:00. S1 is ~45 min of regex ("3.5L", "lakh", "kid 6").

City rule for README: enumerate every ordered sequence of distinct linked cities, ≥2 nights each, first city served by an airport with a valid arrival flight, last by one with a valid return flight; return the cheapest valid package within budget; traveler can switch plans.

## Demo (4 min)

0:00 pitch + quick request fills form · 0:30 build, three cards, timeline walk, checklist green, budget bar · 1:30 change hotel with ±₹, transfer re-picked · 2:15 later arrival flight → G1 warning popup · 2:45 clashing attraction refused, remove allowed · 3:15 confirm, download JSON, open /r/<number></number>, wrong number → not found, restart backend and reload.
Judge requests to rehearse: tiny budget, 22 April, UAE, 4 adults + 3 children.
Q&A: build pipeline, validator, change repair, restart survival; live change in rules.config.ts.

## Pitch headline

**"Change anything. It stays bookable."** Backup: *"Every package checks itself against every rule before you see it."*

## Gemini

Because the entire catalog is only 520 KB across 8 JSON files, **you do not need a complex heuristic or genetic algorithm—you can run an exact, brute-force combinatorial search in memory in under 15 milliseconds.** Your biggest enemy in this 9-hour hackathon isn't scale; it's edge-case rules and time management.

Here is the blueprint to win this with a 2-person team.

---

## 1. How to Build It: Architecture & Strategy

### The Stack (Optimized for Speed & Zero Setup)

* **Backend (Person A):** **Python + FastAPI** (or Node/TypeScript). Load all 8 JSON files into memory at startup into indexed dictionaries. Use **SQLite** (or a single `state.db` / `reservations.json` file synced to disk) so packages and 10-digit reservation numbers survive server restarts (`M7`, Section 7).


* **Frontend (Person B):** **React + Vite + Tailwind CSS + Lucide Icons**. Fast to scaffold, easy to make look polished (15% of grade is UX).


* **1-Command Start:** A root `Makefile` or `start.sh` that runs `uvicorn` and `vite` concurrently.



### The Secret Weapon: Build the Validator First

Judges use an automated tool to check your exported JSON against Section 4 rules. Before writing the package builder, write `validate_package(pkg, request) -> list[str]`.

* If it returns `[]`, the package is 100% legal.


* You will use this exact function to:
1. Verify every candidate package your solver generates.


2. Validate user edits in `M6` (and return the exact human-readable refusal reason if they pick a flight or hotel that breaks a transfer or room rule).


3. Guarantee your exported JSON passes the judges' automated grader.





### The Solver Algorithm (Deterministic Exhaustive Search)

Since $3 \le \text{nights} \le 10$ and each city requires $\ge 2$ consecutive nights with no repeats, a 6-night trip in Japan (3 cities: Tokyo, Kyoto, Osaka) only has **27 possible `(city, nights)` sequences** (e.g., `[Tokyo:6]`, `[Tokyo:3, Kyoto:3]`, `[Tokyo:2, Kyoto:2, Osaka:2]`, etc.). UAE (2 cities) has even fewer.

For a user request, run this pipeline in memory:

1. **Generate City Splits:** Enumerate all valid city sequences where each city has $\ge 2$ nights. (Default "City Rule" for README: *Maximize distinct cities visited up to $\lfloor\text{nights}/2\rfloor$, ordered geographically along the country's transit links, breaking ties by total cost*).


2. **Filter Arrival & Return Flights:**
* Arrival: `from == dep_airport`, `arrival_local` date == `start_date`, `first_city in airport.serves_cities`, and `seats_left >= travelers`.


* Return: `to == dep_airport`, `departure_local` date == `last_day` (`start_date + nights`), `last_city in airport.serves_cities`, and `seats_left >= travelers`.


* *If none exist:* Immediately record the exact reason for `M2` (e.g., *"No flights from Chennai to Japan land on 10 April 2027"*).




3. **Match Hotels & Airport Transfers Jointly (Crucial Edge Case!):**
* An airport transfer must match the flight's `airport` AND the hotel's `city` and `area` (or `area == null`).


* **The Late-Landing Trap:** 5 one-stop flights from BLR to KIX land between `22:10` and `22:50`. Adding the mandatory 60-minute buffer puts pickup at `23:10`–`23:50`. Only **one** KIX transfer runs that late: the `06:00`–`00:30` shuttle to **Namba, Osaka**. Therefore, if a flight lands late at KIX, only hotels in `Namba` (or served by a `00:30` transfer) are valid!


* **Time-Window Math Helper:** Convert `"HH:MM"` to minutes from midnight (`24:00` = 1440). If `service_until < service_from` (like `06:00` to `00:30`), treat `service_until` as `1440 + 30 = 1470`, and treat a post-midnight pickup on the landing night accordingly.


* **Room Fit Math:** For each hotel and room type, test room counts $k \in \{1 \dots \text{adults}\}$. Check:





$$\text{adults} \le k \times \text{max\_adults} \quad \text{AND} \quad (\text{adults} + \text{children}) \le k \times (\text{max\_adults} + \text{max\_children})$$

```
 Verify `rooms_left >= k` in `availability.json` for every night in that city[cite: 1].

```

4. **Intercity Transfers:** On city-change days, pick the link from `destinations.json` (`from_city` $\to$ `to_city`). Schedule it at a clean morning hour (e.g., `10:00`, snapping to `frequency_minutes` inside `service_from`–`service_until`). Do **not** add optional station city taxis—they complicate timing and inflate cost for zero extra points.


5. **Greedy Attraction Scheduler:**
* Filter attractions where `city == hotel.city`, weekday in `open_days`, date not in `closed_dates` (watch out for **Monday 12 April** and **Edo Craft Museum**!), and `city != "Nara"`.


* On each **full day**, greedily pick 2 non-overlapping attractions (e.g., Slot 1 starting at `max(09:30, open_from)`, Slot 2 starting after Slot 1 ends + 60 min buffer) ensuring `start + visit_minutes <= open_until`. (Watch out for 480-minute theme parks like Universal Studios / Disneyland—if chosen, they take the whole day, satisfying the "1–2 attractions" rule by themselves!).


* Leave arrival day, city-change days, and the last day with **0 automatic attractions** (the rules say arrival/city-change days are *optional*, and last day is *forbidden*—keeping arrival/city-change days empty by default avoids transfer-overlap bugs while still letting users add them in `M6`).





### Why You Should Build `G4` (Three Packages) Automatically

Since your solver evaluates all valid combinations in milliseconds, **keep track of three winners simultaneously**:

1. **Cheapest** (lowest total INR—Even if over budget, you *need* this anyway to satisfy `M8: Budget too small`!).


2. **Fastest** (lowest `flight_1.duration + flight_2.duration + sum(intercity_transfer.duration)` within budget).


3. **Best Rated** (highest average `hotel.stars` per night within budget—note: use `stars`, NOT `rating`!).
And include **G2 (Price Difference)** (`+₹4,200` / `-₹1,500` badges on swap dropdowns) and **G3 (Change Cities dropdown)** because your solver already computes them for free!



---

### 9-Hour Execution Timeline (Team of 2)

| Hours | Person A (Backend & Solver Engine) | Person B (Frontend, UX & Export) |
| --- | --- | --- |
| **0:00 – 1:30** | Load catalog JSONs; write pricing formulas, clock/window parser, and `validate_package()`.

 | Scaffold React + Tailwind; lock API JSON contract with Person A; build `M1` Request Form with validation.

 |
| **1:30 – 3:30** | Build the core Solver (`M2`, `M3`, `M8`) returning Cheapest, Fastest, and Best Rated (`G4`).

 | Build Day-by-Day Timeline (`M4`), Sticky Budget Bar (`M5`), and JSON Export formatter (`Section 6`).

 |
| **3:30 – 5:30** | Build Swap/Edit endpoints (`M6`, `G1`, `G2`, `G3`): pre-calculate valid swaps + price deltas + refusal reasons.

 | Build interactive Swap Modals/Drawers for Flights, Hotels, and Attractions with live price deltas (`G2`).

 |
| **5:30 – 7:00** | Build SQLite persistence, 10-digit reservation generator (`M7`), and inventory deduction on confirm (`S2`).

 | Build Confirmation View, 10-digit Lookup Search bar (`M7`), and image attribution footer.

 |
| **7:00 – 8:00** | **Bonus:** Write regex/keyword parser for `S1` (Quick Request in plain words, no LLM).

 | **Torture Testing:** Test Chennai/Mumbai no-flight dates, late KIX landings, 0-budget, and JSON export schema.

 |
| **8:00 – 9:00** | Write `README.md` (startup commands, architecture, city rule, limitations), clean Git commits, zip for HackerEarth.

 | Rehearse the 4-minute Menon demo flow + prep for the 20% live code-change question.

 |

### Critical Gotchas Checklist (Do Not Miss These!)

* **Export JSON Timestamps:** Catalog flights have seconds (`2027-04-09T23:50:00`), but the judges' export validator requires `YYYY-MM-DDTHH:MM` (strip `:00`!) for flights/transfers/attractions and `YYYY-MM-DD` for hotels.


* **Export JSON Fields:** `trip_format_example.json` is missing `"country"` at the root—Section 6 explicitly requires `"country"`, `"room_id"` on hotels, `"sources": []`, and on confirm: `"status": "BOOKED"` and `"booking": {"reference": "1234567890"}`.


* **Child Pricing Fallback:** When `child_price` is `null`/missing (25 attractions, 34 transfers), children pay the full adult `price`. When `child_price.amount == 0` (5 attractions), children go free!


* **Both Members Must Know the Code (20% of Grade):** Spend 20 minutes at Hour 7 walking each other through the backend solver and frontend state so either of you can make a live code tweak on the spot.



---

## 2. What to Show in the 12-Minute Demo

Your live demo portion is strictly **4 minutes** before judges throw custom test cases at you for 3 minutes. Choreograph the 4 minutes like a product launch:

* **0:00 – 0:45 | Fast Start & The Menon Request (`M1`, `S1`, `G4`):**
Start with an empty form. Type `"Bengaluru to Japan, 10 Apr 2027, 6 nights, 2 adults, 1 child age 6, budget 350000"` into your Quick Request bar (`S1`) to auto-fill the 7 fields, and click **Build My Holiday**. Point out that in <20ms, the app chose a 2-city or 3-city route (e.g., Tokyo $\to$ Kyoto) and generated three distinct options (`G4`): **Cheapest**, **Fastest**, and **Best Rated**.


* **0:45 – 1:30 | The Day-by-Day Plan & Rule Proof (`M3`, `M4`, `M5`):**
Select the package. Scroll through the chronological timeline (`M4`):


* Point out `FL-403` (₹21,420) was *automatically skipped* because it only has 2 seats left and the Menons need 3 (`FL-401` or `FL-405` was chosen instead).


* Show the 60-minute airport pickup buffer, the intercity Shinkansen train, the family room allocation, and non-overlapping attractions.


* Highlight the sticky budget tracker (`M5`): Total price vs. ₹3,50,000 budget and exact rupees remaining.




* **1:30 – 2:45 | Live Edits, Price Deltas & Guardrails (`M6`, `G1`, `G2`, `G3`):**
* **Valid Hotel Swap (`M6`, `G2`):** Click "Change Hotel" in Kyoto. Show that every alternative displays the exact price delta (`+₹3,200` / `-₹1,400`). Swap the hotel and watch the airport/city transfer and total budget update live.


* **Guardrail Refusal (`M6`, `G1`):** Try to add **Tokyo Disneyland** on **Monday, 12 April 2027** (or try to pick a flight that breaks transfer service hours). Show the app cleanly refusing the change with the exact rule reason: *"Refused: Tokyo Disneyland is closed on 2027-04-12 (closed_dates)."* Then add a valid attraction and remove another.




* **2:45 – 3:30 | Confirm, Restart Survival & Export (`M7`, `S2`, `Section 6`):**
* Click **Confirm Package** to generate the **10-digit reservation number**.


* Click **Download JSON** (`Section 6`) so it's ready for the judges' grading tool.


* **The Flex:** Kill and restart the backend server in your terminal, paste the 10-digit reservation number into the lookup box, and show the complete confirmed itinerary reloads instantly (`M7`). Also enter a fake number (`0000000000`) to show the required `"Not Found"` state.




* **3:30 – 4:00 | Edge-Case Readiness (`M8`, `M2`):**
* Quickly change the budget to `₹1,00,000` to trigger `M8`: the app states no package fits, displays the exact **cheapest possible total** (e.g., `₹2,18,xxx`), and offers a 1-click suggestion (*"Increase budget by ₹1,18,xxx or reduce trip from 6 to 4 nights"*). Hand the keyboard to the judges right at 4:00.





---

## 3. Your One-Line Pitch Headline

> **"One form, zero broken connections: the constraint-verified holiday engine that builds, customizes, and books multi-city trips where every flight, transfer, room, and ticket is mathematically guaranteed to fit."**

Want me to write the Python `validate_package()` function or the exact JSON export serializer next so you can drop it straight into your repo?

## ChatGPT

My recommendation: **build a constraint-solving holiday planner, not a conventional travel-booking website.**

The hard part of this hackathon isn't displaying flights and hotels. It's finding a combination where every component works with every other component, and continuing to maintain that correctness when the user changes something.

You have 9 hours and two developers. I'd prioritize one genuinely correct, dynamically generated package, excellent validation, and a polished end-to-end experience. I would deliberately avoid chasing all the stretch features.

Here's how I'd approach it.

# **1. Understand what you're actually building**

Think of the application as three systems working together:

1\. INPUT

**Traveler requirements**

Departure · Country · Date · Nights · Adults · Children · Budget

**2. HOLIDAY ENGINE**

The brain

City selection

Flight matching

Hotel matching

Transfer matching

Attraction scheduling

Pricing & validation

3\. OUTPUT

**A complete validated holiday**

Day-by-day itinerary · Price · Editable components · Reservation

There is one important architectural decision here:

**The validator must be independent of the package generator.**

The generator proposes a holiday. The validator decides whether that holiday is actually valid.

This distinction will save you during the hackathon.

For example, suppose the generator selects:

- A flight landing at KIX.
- A hotel in Osaka.
- An airport bus serving only a different area.
- A pickup time outside the transfer's operating hours.

The generator might think it has constructed a package. Your validator must reject it.

The same validator should run after every user modification.

The judges explicitly test unseen requests and changes, so a hardcoded Menon itinerary is not going to cut it.&#x20;

PROBLEM.md



# **2. Technology stack**

I'd use the following:

[React Logo, Interactive, JavaScript, Web Development, Library PNG](https://images.openai.com/static-rsc-4/Fl2k_M2MV9G60-G7WybCJohvSsz5vwqQsQppvr32F68EV081GHJtW9RJC9qzUmIyqYoKRib8QukYMDHeoi9S68vPmo6QWCkUSZ04wokMQon4iVyQtTjASZavNLZps_OHoxGIXYHG61QQxMlUTbtbDTcfPlPzUqtZndtSvw9CQCM?purpose=inline)

**Frontend: React + TypeScript + Tailwind**

Forms, itinerary, editing, booking summary

[FastAPI Training online | Certification Course](https://images.openai.com/static-rsc-4/3oqMqrp7oPRSriMt9xXVBHZHsPei8fEWuA-8L4K7XuJ6mr_sRjvu-9xG8XhwQ6Cxii8kMDYBf2IPpic0w9lsd_WWzuUoqZsnVObn85H1cUBOsBkrUM-hiHgqvF7zNkL7ioxWOvl6qzqnTZgxAN23QuSS09nFm6DaRwaX6wcibpI?purpose=inline)

**Backend: Python + FastAPI**

Planning, validation, scheduling and pricing

[Logo SQLite – Logos PNG](https://images.openai.com/static-rsc-4/DB8WVS6NrLCtUSYIc2zTPGzrMvrfjPYZpaPLLiELKaGa-8ig6i55NjodHWZqWiL__4SWevhxL3ba1kAF3Oq8brovMP1dXTdtm6k7QmtOMoYPoCrfB7byzg0w9qPHn11PT6I-8w3z6cczqMbyPlGjM0DKm0LT-4oa8zA_FnqDFow?purpose=inline)

**Database: SQLite**

Saved packages and confirmed reservations

[Pydantic (@pydantic) on X](https://images.openai.com/static-rsc-4/xfsAV07-hZsEr3M35w_gkFQQ1MA1JdX8TRZMJaUUS-ZIx55JQUE6PKNOI6tR_ueM4WvoP62BssPJESTi4w5YP5uuQtSuuYyLjGfQhOnHlmtrm1MJACzE59vVHuSBoxYdOZ8SNWWci1mhslxjpoEnNGjY3GpbYU2agTQSFqNYrDE?purpose=inline)

**Pydantic**

API input and output validation

Why this stack?

- Python makes it easy to work with JSON, dates, combinations and filtering.
- FastAPI gives you a working backend quickly.
- React gives you enough control to build a genuinely impressive interface.
- SQLite is sufficient for persistent state and doesn't need any external setup.

Don't introduce Redis, PostgreSQL, Docker orchestration, microservices, or anything else that doesn't directly help you finish.

A simple architecture:

```
frontend/
  src/
    components/
    pages/
    api/
    types/

backend/
  app/
    main.py
    catalog.py
    planner.py
    validator.py
    pricing.py
    mutations.py
    repository.py
    models.py
  data/
    catalog/
  database.db

README.md
```

The catalog files remain unchanged. Load them once into memory when the backend starts and build indexes for efficient lookups.

# **3. The actual holiday-generation algorithm**

This is where I'd spend most of your engineering time.

You have a relatively small dataset:

| Resource                | Records |
| ----------------------- | ------- |
| Flights                 | 469     |
| Hotels                  | 49      |
| Room types              | 125     |
| Room-night availability | 2,500   |
| Transfers               | 66      |
| Attractions             | 56      |

There are only three Japanese destination cities and two UAE destination cities. This is a manageable search problem, especially if you filter candidates early.&#x20;

profile.md



I would not build a complicated optimization solver.

I'd implement deterministic candidate enumeration with pruning and validation.

## **Step A: Generate possible city plans**

The user doesn't select cities. The application does.

Your `destinations.json` contains the city connections.

Represent these as a directed graph:

**Japan**

**Tokyo**

**Kyoto**

**Osaka**

The catalog contains all six directed city-pair links.

**UAE**

**Dubai**

**Abu Dhabi**

Each city must have at least two consecutive nights, and a city cannot appear twice.

For six nights in Japan, possible plans include:

- Tokyo: 6 nights.
- Tokyo → Kyoto: 4 + 2 nights.
- Tokyo → Kyoto → Osaka: 2 + 2 + 2 nights.
- And other valid orderings and allocations.

**Your city-selection rule matters.** It is explicitly left to the teams and must be documented in the README.

My proposed rule:

1. Enumerate all connected city sequences without repetition.
2. Enumerate all allocations of the requested nights, with at least two nights per city.
3. Construct valid packages for those plans.
4. Select the cheapest complete package within budget.
5. If none is within budget, select the cheapest complete package overall.

This is deterministic, easy to explain, and naturally handles different countries and trip lengths.

## **Step B: Find flights**

For each candidate city plan, find an arrival and return flight.

Arrival flight filters:

- `from` equals the requested departure airport.
- Local arrival date equals the requested holiday start date.
- Destination airport serves the first city.
- `seats_left >= adults + children`.

Return flight filters:

- `to` equals the departure airport.
- Local departure date equals `start_date + nights`.
- Departure airport serves the last city.
- Sufficient seats remain.

A crucial detail: arrival and return airports do not have to be identical.

Do not accidentally require a round trip through the same airport.

Also, don't confuse the date the flight leaves India with the holiday start date. The flight can depart the evening before and land on the first day of the holiday.

## **Step C: Find hotels and rooms**

This is an important one because of the room-capacity formula.

Suppose the traveler has:

- 2 adults
- 1 child

A TWIN room accommodates 2 adults and 0 children.

Therefore, one TWIN room isn't sufficient. Two might be.

A FAMILY room accommodates 2 adults and 2 children, so one is sufficient.

For every room type, calculate the smallest valid number of rooms `k`, checking:

\\[ adults \leq k \times maxAdults \\]

\\[ adults+children \leq k \times (maxAdults+maxChildren) \\]

\\[ adults \geq k \\]

Then check `rooms_left >= k` on **every single night** of the hotel stay.

Don't just check availability on the check-in date.

For each city, you need one hotel and one room type throughout that city's stay. You can have multiple rooms of that type.

I'd implement:

```
def find_room_count(room, adults, children):    total = adults + children    for k in range(1, adults + 1):        fits_adults = adults <= k * room.max_adults        fits_total = total <= k * (            room.max_adults + room.max_children        )        if fits_adults and fits_total:            return k    return None
```

This function gives you the required room count, or tells you that the room type cannot accommodate the party.

## **Step D: Match transfers**

You have three distinct transfer problems.

**1. Arrival airport → first hotel**

Filter transfers by:

- Airport.
- Destination city.
- Hotel area (or a `null` area, which serves all areas).

Then calculate:

\\[ pickup = landing + 60\text{ minutes} \\]

Check that the pickup time is within the transfer's service hours.

**2. Last hotel → return airport**

Calculate the time the traveler must leave:

\\[ hotelDeparture = flightDeparture - transferDuration - 180\text{ minutes} \\]

This ensures arrival at the airport at least three hours before departure.

Then check whether the hotel departure time is inside service hours.

**3. Transfers between cities**

Use the exact `transfer_ids` provided by the city link.

Check `from_city`, `to_city` and service hours.

You don't need city taxis to and from stations. They are optional, and I'd skip them.

One implementation detail I would absolutely get right: service windows can cross midnight.

For example, `06:00–00:30` means the service continues until half past midnight the following day. Don't compare times as plain strings.

Use proper datetime/minute arithmetic, and test both the day of the window and the preceding day when checking an overnight interval.

## **Step E: Schedule attractions**

I would deliberately keep this simple.

The first package needs 1–2 attractions on each full day.

Arrival days and city-change days are optional. The last day has no attractions.

For your first implementation, schedule exactly **one attraction per full day**.

For each eligible date:

1. Get attractions belonging to that day's hotel city.
2. Check weekday availability.
3. Check `closed_dates`.
4. Check whether the complete visit fits inside opening hours.
5. Schedule one attraction at a valid starting time.
6. Ensure attractions don't overlap and aren't repeated.

Why one?

Because one valid attraction satisfies the mandatory requirement. You can add a second later, but don't introduce scheduling complexity unnecessarily.

Avoid attractions with very long visit durations until you know your scheduler handles them correctly.

## **Step F: Calculate the final price**

Centralize pricing in one module.

| Component            | Calculation                                   |
| -------------------- | --------------------------------------------- |
| Flights              | Price per seat × travelers                    |
| Hotels               | Price per night × rooms × nights              |
| Per-person transfer  | Adults × adult price + children × child price |
| Per-vehicle transfer | Price × vehicles required                     |
| Attractions          | Adults × adult price + children × child price |

For missing `child_price`, use the adult price. However, preserve an explicit zero child price because some children travel free for certain attractions.

Keep prices as integers. Avoid floating-point arithmetic entirely.

# **4. The most important module: Package Validator**

I'd actually build this before the generator.

Every complete itinerary must go through this function:

```
def validate_package(package, request):    errors = []    errors += validate_dates(package, request)    errors += validate_city_plan(package)    errors += validate_flights(package, request)    errors += validate_airport_transfers(package)    errors += validate_city_transfers(package)    errors += validate_hotels(package, request)    errors += validate_attractions(package)    errors += validate_prices(package, request)    return errors
```

These should be independent functions.

The generator's responsibility is to find a candidate.

The validator's responsibility is to catch anything that violates the rules, including mistakes made by the generator.

My strongest engineering recommendation

Use the exact same validator for the initial package and every subsequent modification.

Imagine the traveler changes their hotel.

Your backend should:

1. Copy the existing package.
2. Replace the selected hotel.
3. Recalculate the required rooms and price.
4. Find a suitable airport transfer if the new hotel has a different area.
5. Recalculate the total.
6. Validate the entire itinerary.
7. Save the modification only if validation succeeds.

Do not update the existing package halfway through the operation.

Treat each modification as a transaction. Either the complete new package is valid and saved, or the old package remains untouched.

This is a great demonstration of good engineering, too.

# **5. User modifications**

M6 deserves particular attention because it's one of the features judges can interact with.

I'd implement the three changes as follows.

| Change            | What must be rechecked                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| Change hotel      | Room capacity, availability, hotel price, airport transfer compatibility |
| Change flight     | Date, airport, seats, airport transfer timing and compatibility          |
| Add attraction    | City, opening hours, visit duration, conflicts, duplicate selection      |
| Remove attraction | Full-day attraction count and remaining schedule                         |

For example, the user changes their arrival flight from HND to KIX.

Your system shouldn't blindly accept it.

KIX must serve the first city, and the selected arrival hotel must still have a compatible transfer from KIX with a valid pickup time.

Otherwise, reject the change with a useful message.

Also, be consistent about the attraction rule after modifications. I'd enforce one to two attractions on every full day for the modified package too, even though the statement doesn't explicitly settle whether the original requirement applies after editing.

# **6. Backend APIs**

Don't overcomplicate your API design.

I'd start with these:

| Endpoint                            | Purpose                        |
| ----------------------------------- | ------------------------------ |
| `GET /api/catalog/options`          | Departure cities and countries |
| `POST /api/trips/generate`          | Generate a package             |
| `GET /api/trips/{id}`               | Retrieve saved package         |
| `PATCH /api/trips/{id}/hotel`       | Change a hotel                 |
| `PATCH /api/trips/{id}/flight`      | Change a flight                |
| `PATCH /api/trips/{id}/attractions` | Add/remove attractions         |
| `POST /api/trips/{id}/confirm`      | Confirm and generate reference |
| `GET /api/reservations/{reference}` | Retrieve reservation           |
| `GET /api/trips/{id}/export`        | Export trip JSON               |

The frontend should never load catalog files directly. All information and decisions must come through your backend.

## **Persistence**

Use SQLite with two basic tables:

```
CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    package_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE reservations (
    reference TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    package_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

Generate the reservation number as a 10-character string:

```
import secretsreference = f"{secrets.randbelow(10**10):010d}"
```

Enforce uniqueness in the database and regenerate on collision.

Store the complete confirmed package as JSON in SQLite.

When the backend restarts, you can retrieve it using the reservation number.

One detail: don't just store the reservation number. Store the entire package snapshot.

And remember: confirming is a simulated reservation in your application, not an actual booking. Don't mutate the original catalog availability files.

## **Export format**

This is a surprisingly important part.

The judges will load the exported JSON into their checking tool.

Use `trip_format_example.json` as the starting point. Your output must additionally include:

- `country`.
- A `room_id` on every hotel item.
- `status: "BOOKED"` after confirmation.
- `booking.reference` as the reservation number string.
- `sources: []`.
- Local timestamps in the required date/time format.

Don't invent a custom export structure just because it is convenient for your frontend.

Also, `traveler.name` is an unresolved question in your problem notes. The form doesn't request a name, so I'd ask the organizers about the expected value.&#x20;

PROBLEM.md



# **7. What I'd build on the frontend**

Don't spend three hours building a fancy landing page.

The application should feel like a premium travel planner, not an admin dashboard.

I'd create three main screens.

## **Screen 1: Build your holiday**

[Travel Planning Web App with Itinerary Builder by Ronas IT | UI/UX Team on Dribbble](https://images.openai.com/static-rsc-4/oWZwJqLInPO3SlpubUVom1Jtu96SRtWWes3JYQHp6lYfSQG-snKQXmNB2ulVGubYrk6j10iL1JOZPOjMcKFLUPumwsIk83mxUwVYyExXkQZTIAvsVKbUsSPx54CpAgF3aRkhgecOplbNtF26CVN1S-WYVqf3vWzx-XctoxaI2XE?purpose=inline)

[dribbble.com](https://dribbble.com/shots/27117356-Travel-Planning-Web-App-with-Itinerary-Builder?utm_source=chatgpt.com)

A beautiful, clean form with the seven mandatory fields.

I would add:

- Departure city dropdown.
- Destination country dropdown.
- Date picker.
- Nights selector.
- Adults selector.
- Children's ages (dynamic inputs).
- Budget input with INR formatting.

Use the backend to populate departure cities and countries.

## **Screen 2: Your holiday**

[WeTravel: Trip Management for Custom Group Travel](https://images.openai.com/static-rsc-4/m5DAD0Nky4Ov9wNm2tTKi8liWaePtAe7NZThiKd0gEOQo8TQusmiUQ28vLFur1PeN9WJ4Y1sqHMwYW_3rYrsyPDJtMoSor3S-VolASVwdwjn8Ff1fSFE_CLaTJrYnfLMTIY5LI48AjJTSu-i2TtQ1ScE06AblU8kmvYvEFexuuY?purpose=inline)

[product.wetravel.com](https://product.wetravel.com/custom-luxury-travel-businesses?utm_source=chatgpt.com)

This is the most important screen.

I would design it around:

**Top section:** Destination cities, travel dates, traveler count and total budget.

**Main section:** Day-by-day itinerary timeline.

For example, a six-night trip might look like this:

**Your Japan holiday**

Validated

10–16 April 2027

6 nights

3 travelers

1. **10 April · Arrival**

   Flight → Airport transfer → Hotel check-in
2. **11 April · Exploration**

   Attraction → Free time → Hotel
3. **12 April · City change**

   Checkout → Intercity transfer → New hotel
4. **13 April · Exploration**

   Attraction → Free time → Hotel
5. **14 April · City change**

   Checkout → Intercity transfer → New hotel
6. **15 April · Exploration**

   Attraction → Free time → Hotel
7. **16 April · Departure**

   Airport transfer → Return flight

Illustrative timeline only, not a computed package.

**Package breakdown**

| Component   | Price  |
| ----------- | ------ |
| Flights     | ₹X     |
| Hotels      | ₹X     |
| Transfers   | ₹X     |
| Attractions | ₹X     |
| **Total**   | **₹X** |

Every component should have its own change button.

Show the price difference when the user changes something.

I would also include a small validation panel explaining that flights, room capacity, hotel availability, transfer times and attraction schedules have all passed.

This makes the engineering visible to judges.

## **Screen 3: Confirmation**

[Booking confirmation page for a travel agency website by Jana on Dribbble](https://images.openai.com/static-rsc-4/LlAnoIUBngAwYm5uGII5eFpnOWrINprEOWnSmzpDoQLhjv6R-tddDh5IP-watmylAu_VhEGXKfDGlaR_mhMRZ6lNajxsouQ8rdiGUDagpWP37pL8YIYsj7AdSAeloFVQzepQDDJrw6uyMHDdhOL4cXZ6hYmsJRNOgHjLgKSXdw8?purpose=inline)

[dribbble.com](https://dribbble.com/shots/23383252-Booking-confirmation-page-for-a-travel-agency-website?utm_source=chatgpt.com)

Show:

- Booking confirmation.
- Large 10-digit reference.
- Total paid/confirmed amount (clearly no payment was made).
- Download itinerary JSON.
- Retrieve reservation by reference.

This gives you a complete product journey.

# **8. How I'd divide the 9 hours**

This is where I would be quite disciplined. You cannot afford two people working on the same things without a clear contract.

## **Team allocation**

**Developer A**

Backend owner

Catalog loading, planning algorithm, validator, pricing, transfers, persistence, export.

**Developer B**

Frontend owner

Form, itinerary UI, editing interfaces, booking summary, API integration and UI error states.

**Both:** Initial API contract, integration testing, edge cases and demo rehearsal.

The frontend developer should work against a mock package JSON while the backend is being built. Do not wait for the backend to finish before starting React.

## **The timeline**

**Hour 0–1**

Foundation

Agree on the package JSON structure, initialize frontend/backend, load catalog files and build indexes. Get both servers running.

**Hour 1–3**

Core engine

Backend: room fit, flight filters, transfer checks, pricing, validator and the first complete itinerary.

Frontend: request form, results-page layout and mock itinerary data.

**Hour 3–5**

Must-have functionality

Backend: city-plan enumeration, attraction scheduling, complete validation, hotel/flight/attraction modifications.

Frontend: API integration, real timeline, edit interfaces and budget display.

**Hour 5–6.5**

Persistence

SQLite storage, reservation confirmation, retrieval by reference, JSON export.

**Hour 6.5–8**

Testing and polish

Test unseen requests, fix validation bugs, improve errors and finish the frontend.

**Hour 8–9**

Freeze and rehearse

README, setup instructions, Git push, clean startup test, demo rehearsal and backup screenshots.

Push to GitHub every hour as the organizers require.

# **9. The test cases I'd prioritize**

This dataset has some interesting traps. I'd use them to test your application instead of randomly trying requests.

| Test                                        | Why it matters                                  |
| ------------------------------------------- | ----------------------------------------------- |
| Menon: BLR → Japan, 10 April, 6 nights      | Main happy path                                 |
| Chennai → Japan, 10 April                   | Profile identifies no arrival flight that day   |
| Three travelers, flight with only two seats | Seat validation                                 |
| 2 adults + 1 child, TWIN room               | Room capacity calculation                       |
| Stay containing a sold-out room night       | Availability across the full stay               |
| Late KIX arrival                            | Transfer operating hours crossing midnight      |
| Tokyo, 12 April                             | Disneyland closure                              |
| Very low budget                             | M8: cheapest valid package and budget shortfall |
| Different departure city → UAE              | Generalization beyond the demo                  |
| Flight change to incompatible airport       | Mutation validation                             |
| Backend restart after confirmation          | Persistence                                     |

Some especially important dataset details:

- `FL-403` has only two seats.
- There are 61 fully booked room-nights.
- The KIX airport shuttle to Namba runs until 00:30.
- Tokyo Disneyland is closed on 12 April.
- The UAE flights operate daily, while some Indian departure-city-to-Japan combinations have date gaps.

These aren't hypothetical edge cases. They're documented in the supplied data profile.&#x20;

PROBLEM.md

profile.md



One more important distinction:

**No feasible package is not the same as no package within budget.**

Your backend should return these separately.

For example:

```
{
  "status": "OVER_BUDGET",
  "cheapest_total": 385000,
  "budget": 350000,
  "shortfall": 35000,
  "suggestion": "Try a lower-cost hotel or a shorter city itinerary"
}
```

This is only an illustrative API response, but the distinction is essential.

When there is no possible itinerary, return the actual reason instead: unavailable flight, insufficient seats, unavailable rooms, incompatible transfer, etc.

# **10. What I'd actually show in the 12-minute demo**

The organizers already specify four minutes for the Menon request, three minutes for judge requests, four minutes for questions, and one minute for changeover.

I'd prepare the following.

## **First 4 minutes: Menon family**

[Japonya Turu 7 Gece 8 Gün – Tokyo Kyoto Osaka Tatil Paketi](https://images.openai.com/static-rsc-4/5M9i3emprLdv5UwIZID__reFTxcq2ahgVJIOILVXrY6j0cuW7sblruGPYIs7tbgjZNDfPMJ1_zNp6ZTDeYvV-UdweMJCitPY-bIS__TnNXo-JRPUr39IDcXnFLkP4uIMjwC_LGoxAbO9k0RN6ru-nXXf5L3u4-91_dSqUWN_bbM?purpose=inline)

**The Menon family's first Japan holiday**

Bengaluru · Japan · 10–16 April 2027

**2 adults + 1 child · ₹3,50,000**

**0:00–0:40 — Enter the trip**

Fill the seven fields and build the holiday.

**0:40–1:30 — Show the generated package**

Show the app-selected cities, flights, hotels, transfers, attractions and total.

Make the validation panel visible.

**1:30–2:30 — Change the hotel**

Select another hotel. Show the updated room requirement, transfer compatibility, and price difference.

**2:30–3:15 — Change an attraction or flight**

Demonstrate a successful change and an invalid change that gets rejected with an actual explanation.

**3:15–4:00 — Confirm**

Generate the reservation number, copy it, navigate away and retrieve the complete package.

That's the entire product journey.

## **Next 3 minutes: Judge requests**

This is where you can distinguish yourselves from teams that have built a one-scenario demo.

Have three test requests ready:

1. A different departure city and the UAE.
2. A request that has flights and hotels available but exceeds budget.
3. A request with no possible flights.

Let the judges enter the details rather than selecting a hardcoded result.

## **Next 4 minutes: Questions**

Both developers should be able to explain:

- How the city-selection algorithm works.
- How room capacity is calculated.
- Why a flight or transfer is accepted or rejected.
- How the validator works.
- How the reservation survives a backend restart.

Remember that individual understanding carries 20% of the score. Don't build something neither of you can explain.

# **11. What I would deliberately NOT build**

This is probably just as important as what you build.

| Feature                           | My decision                   |
| --------------------------------- | ----------------------------- |
| Three package variants (G4)       | Skip initially                |
| Change cities manually (G3)       | Skip                          |
| Plain-English AI request (S1)     | Skip                          |
| Actual inventory consumption (S2) | Skip                          |
| Login and payments                | Absolutely skip               |
| Fancy maps and geolocation        | Skip initially                |
| Hotel and attraction photographs  | Only if everything else works |

The problem explicitly says that one correct package is better than three broken packages.

I would take that literally.

One thing I would spend extra time on is a good interface for errors. Most teams focus on the happy path. But a product that explains *why* a particular flight, hotel or transfer cannot work feels much more complete.

# **12. Your one-line pitch**

My favourite:

My pick

# **Your whole holiday, stitched together. Every detail checked.**

From the first flight to the final transfer, we build a complete holiday where every component fits your dates, travelers, availability and budget.

&#x20;Copy headline

A few alternatives:

**More product-oriented:** "One request. Every booking connected. One complete holiday."

**More emotional:** "Stop piecing together your holiday. Let us make everything fit."

**More technical:** "End-to-end holiday planning, with every connection validated before confirmation."

I'd stick with the first one. It communicates the actual differentiator rather than making generic claims about AI or personalization.

## **My final advice: prioritize these five things**

If I were competing in this hackathon, this is how I'd rank the work:

1. **A working constraint engine.** It must generate a valid package for different dates, countries, travelers and departure cities.
2. **An independent validator.** Every package and every modification must pass through it.
3. **JSON export and persistence.** Judges can directly verify your package and retrieve reservations after restart.
4. **A genuinely polished itinerary UI.** Make the complex package understandable at a glance.
5. **A reproducible demo.** Have your edge cases ready and make sure both developers understand the implementation.

One final thought: the strongest thing you can show the judges isn't how many attractions you can display or how beautiful your hotel cards look.

It's this:

**A traveler changes one flight, and your application intelligently determines whether the rest of the holiday still works.**

That is the actual problem they're asking you to solve. Nail that, and you'll have something considerably more impressive than another travel website.

## The basic slop solution

What most teams will build, demo and say. All three answers agree unless a line says otherwise. Next, we 10x it with our own ideas.

### They will build

- The catalog loaded into memory at startup, with indexes: flights by date and airport, airports by city, availability by room and night, transfers by route, attractions by city. A small database (SQLite in all three) holds only packages and reservations.
- **A validator separate from the builder:** `validate(package) → violations[]` covers every rule in §4. It runs on every built package, after every change and before export. Gemini and ChatGPT say to write it first.
- **Brute force over city plans:** every order of distinct linked cities, at least 2 nights each, adding up to the trip. That's 27 plans for 6 nights in Japan. Prune by flights first (the arrival lands on the start date at an airport serving the first city; the return leaves on the last day from an airport serving the last city), then fill hotels, transfers and attractions greedily.
- Room fit: the smallest `k` for each room type, then `rooms_left ≥ k` on every night.
- Times as minutes from midnight, with one helper for windows that cross midnight (`06:00`–`00:30`, `24:00`). Pickup = landing + 60. Leave the hotel = departure − 180 − transfer duration.
- Prices in whole rupees. A missing `child_price` falls back to the adult price, and a `child_price` of 0 means children go free.
- No station taxis on city-change days.
- **Two different answers when nothing works:** no possible package (with the reason), or packages that exist but none within budget (the cheapest total and the gap).
- **A change** is applied to a copy, the parts that depend on it are repaired (for example the airport transfer re-picked for a new hotel area), and the whole package is validated. It's then saved, or refused with the reason. Option lists show only valid choices, each with its price difference (G2).
- **Confirm:** a random 10-digit number, unique in the database, saved with a full snapshot of the package and status `BOOKED`.
- **Export** in the shared trip format: `country`, `room_id`, `sources: []`, local times without seconds.
- **Screens:**
  - a form with dropdowns filled from the API and inputs for the children's ages;
  - a day-by-day timeline;
  - a budget bar and a price breakdown;
  - "Change" on every item;
  - a panel showing the rules passing (Claude's "rule checklist", ChatGPT's "validation panel");
  - a confirm page, and lookup by number with "not found".
- **Team split:** one person on the engine, one on the screens, with the API shape agreed first. ChatGPT has the frontend work against a mock package in the meantime. All three plan a code walkthrough swap before the demo.
- **Tests on the data traps:** `FL-403`'s 2 seats, late `KIX` landings (only the Namba shuttle still runs), Disneyland closed on 12 Apr, the no-flight days from `MAA`, `BOM` and `DEL`, a tiny budget, the UAE, and a restart after confirm. Claude adds a fuzz test: about 300 random requests through build, export and validate.

### Where they split

- **Stack:** Node + TypeScript (Claude), or Python + FastAPI (Gemini, ChatGPT). SQLite in all three.
- **Which package comes first (the city rule):** the cheapest within budget (Claude, ChatGPT), or the most cities up to nights ÷ 2, in order along the links, cheapest on a tie (Gemini).
- **Attractions per full day:** 1 (ChatGPT), 1–2 cheapest first (Claude), or 2 (Gemini). Gemini and ChatGPT add none by default on the arrival day and city-change days.
- **After a change:** the 1–2 per full day rule applies only to the first package, so removing is always allowed (Claude), or it still applies (ChatGPT).
- **When a change breaks another part (G1):** repair it and warn (Claude, Gemini), or refuse (ChatGPT).
- **Scope:** G4, G3, S1 (a regex quick request) and S2 (an inventory table), because the enumeration makes G4 and G3 nearly free (Claude, Gemini). ChatGPT builds none of them.
- **"Suggest a change" (M8):**
  - Claude re-runs the builder on variants (one fewer night, a start date 1–2 days either side, the other country) and shows the ones that fit.
  - Gemini suggests "raise the budget by X or cut nights".
  - ChatGPT uses fixed text.
- **Reservation number:** the first digit is never 0 (Claude), or any 10 digits padded with zeros (ChatGPT).
- **Time of the inter-city transfer:** 10:00, snapped to the departure grid (Gemini). The others don't say.
- **Preparing for the live code change:** all rule numbers in one `rules.config` file (Claude only).

### They will demo

1. Start from the empty form, enter the Menon request and press Build. Claude and Gemini type it into the quick-request box and show three cards: cheapest, fastest and best rated.
2. Walk through the timeline:
   - the overnight flight;
   - the pickup at least 60 minutes after landing;
   - the city change;
   - the last day with no hotel;
   - the rules panel all green and the budget bar showing ₹ left.

   Gemini points out that `FL-403` was skipped because it has only 2 seats.
3. Change the hotel: the options show ±₹, the total updates, and the airport transfer is re-picked if the area changed.
4. An invalid change is refused with the exact reason: a clashing attraction, Disneyland on 12 Apr, or a flight at the wrong airport. Claude also moves the arrival flight later and shows the G1 popup.
5. Confirm, get the 10-digit number, download the JSON and reopen the reservation by its number. A wrong number shows "not found". Claude and Gemini end with the restart: kill the backend, reload, and the reservation is still there.
6. The judge requests they rehearse: a tiny budget (M8), a date with no flights (M2), the UAE, and a large family needing several rooms.

### They will say

- Claude: "Change anything. It stays bookable."
- Gemini: "One form, zero broken connections", for a constraint-verified engine where every part is guaranteed to fit.
- ChatGPT: "Your whole holiday, stitched together. Every detail checked."

All three have the same shape: a complete holiday, with every part checked.

### Reading it

- **Correctness is the price of entry, not an edge.** Every answer has the separate validator, the brute force, a rules panel and an "everything checked" headline. The judges will hear it from most teams on this statement.
- **ChatGPT and Gemini saw our data notes.** Both cite `PROBLEM.md` and `profile.md`, so their data traps (`FL-403`, the Namba shuttle, Disneyland, seconds in the export) came from our profile, not from the plain prompt. Treat the traps as table stakes anyway: any team whose agent reads the data will find them.
- **No answer uses the fields about the customer:** `family_friendly` on hotels, `child_friendly` and `accessible` on attractions, `refundable` on rooms, `aliases`, `lat` and `lng`. The child counts only as a price and a seat.
- **Judge requests will hit dead ends.** From Chennai, Mumbai or Delhi to Japan, 35–45% of valid start-date and trip-length combinations have no arrival or no return flight (Bengaluru, and every city to the UAE: 0%). We checked this on 13 Nov, ignoring seats. Only Claude turns a dead end into options it has tested, and only for budget.
- **Every team will run the same 4-minute script:** build, change the hotel (±₹), a refused change, confirm, reopen, "not found", restart.
- **Mistakes in the answers:**
  - Within one room type, the smallest `k` always wins, because the price and the rooms needed both grow with `k`. Trying every `k` (Claude) adds nothing.
  - "Pickup after midnight" never comes up in this data if we always take the earliest valid pickup. The latest landing is 22:50, so the pickup is at 23:50, and every arrival flight has an airport transfer running at landing + 60 (checked on 13 Nov, ignoring city and area).
  - Claude counts a date outside the data window as an invalid value (M1). Whether it is M1 or M2 is still open. Either way gives a clear message.

### The run

The fresh Claude took 2 min 20 s. ChatGPT and Gemini were collected by hand.

## 10x it

Our ideas on top of the basic slop solution. Our edge is what it lacks, picked by value to the customer per hour of building. Add Pranjal's and Saumya's ideas to the table before picking.

### Basics we were missing

The slop solution has these and our plan didn't, so they come in as basics, not as our edge:

- A rules panel on the package screen.
- A fuzz test: random requests through build, export and validate, checking that the total equals the sum of the parts.
- All rule numbers in one rules file, for the live code change.
- The restart moment in the demo.
- The frontend builds against a saved example package while the engine is being written.
- Questions to the help desk early.

### Ideas

| Idea | In the slop solution? | Value to the customer | Effort |
| ---- | --------------------- | --------------------- | ------ |
| **Never a dead end.** Every "no package" and "over budget" answer comes with options the builder has actually checked: a start date 1–3 days either side, fewer nights, another departure city, the other country. Each one rebuilds in one click. | Claude only, and only for budget | High: from "no" to a holiday they can book. Judges' unseen requests will land here often (35–45% of dates from `MAA`, `BOM` and `DEL` to Japan) | S–M once the builder exists, because it runs in milliseconds |
| **See what changed.** After any change, a before-and-after list with ₹ per line and in total: what the traveler changed, and what the app repaired and why (for example the airport taxi re-picked for the new area, or an attraction dropped because the later flight lands after closing time). | Claude and Gemini show a warning popup; none shows the whole difference | High: the statement's own pain ("when one part changes, other parts often stop fitting"), made visible | S–M: compare two packages item by item |
| **The night before, made obvious.** "You leave Bengaluru on Fri 9 Apr at 23:50, the evening before your holiday starts." Local times with the time zone, and "+1" where the date changes. | No | High for a family who reads "starts 10 Apr" | S |
| **A package for families.** When children travel, prefer `family_friendly` hotels and `child_friendly` attractions and label them. One outing per full day. | No | Medium. The data already makes most choices child-friendly (52 of 56 attractions, 36 of 49 hotels), so it mostly changes labels and some hotels | S |
| Quick request (S1), using the `aliases` | Claude, Gemini | Medium, and it shows well in a demo | S–M |
| Booking uses up seats and rooms (S2), safe against races and repeats: two tabs fight for the last seats and one wins; a double click books once | Claude and Gemini, without the protection against repeats | Medium; a strong Q&A story for Booking engineers | M (the boilerplate has the pattern) |
| Photos, with the credits | Optional in all three | Medium | S |
| A short "why these cities" line on the package | No | Medium | S |
| A calendar file (.ics) or a printable trip | No | Low to medium | S |
| A map from `lat` and `lng` | No | Low to medium; the map tiles need internet | M |

### Picks

Proposed by the agent; confirm with Saumya: **never a dead end** and **see what changed**. "The night before" is S effort, so it goes in as a basic. The rest go to `IDEAS.md`.
