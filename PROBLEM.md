# Problem

Anyone, human or agent, should be able to start solving from this page alone.

**No solutions here:** no choices, features or designs. Those go in `docs/SOLUTION.md`. Change this page only if the organisers change something.

## The statement, word for word

Source: `problem-statement/Intern Hackathon - Problem 1_ Holiday Package - Build My Holiday095dbf6.pdf`. The data zip holds the same text as `problem-1-holiday-package.md` (word-for-word check, 13 Nov). The flow image is transcribed in square brackets.

<details>
<summary>Problem 1: Holiday Package → Build My Holiday (full text)</summary>

> # Problem 1: Holiday Package → Build My Holiday
>
> ## At a glance
>
> | Topic | In short |
> |---|---|
> | **The traveler gives** | Departure city, destination country, holiday start date, number of nights, adults, children's ages, budget |
> | **Your app builds** | One complete holiday package: flights, hotels, airport transfers, transfers between cities, and attractions. **Your app chooses the cities.** |
> | **The traveler can** | Change the hotel, change a flight, add or remove attractions |
> | **At the end** | The traveler confirms and gets a **10-digit reservation number** that opens a summary of the package |
> | **The event** | Teams of 2. About 9–10 hours to build. A 12-minute demo at the end. |
>
> ---
>
> ## 1. The traveler
>
> A holiday abroad has many parts, and when one part changes, other parts often stop fitting. Build an app that puts the parts together correctly, keeps them correct after each change, and books the result.
>
> The **Menon family** from Bengaluru (two adults, one child aged 6) wants their first holiday in Japan:
>
> | Request | Value |
> |---|---|
> | Departure city | Bengaluru (BLR) |
> | Destination country | Japan |
> | Holiday start date | 10 April 2027 |
> | Nights | 6 |
> | Travelers | 2 adults, 1 child (age 6) |
> | Budget | ₹3,50,000 for everything |
>
> The **holiday start date** is the first day in the destination country: the arrival flight lands on that day. An overnight flight leaves India the evening before. The family flies home on the last day (16 April), with no hotel night that day.
>
> ---
>
> ## 2. What you build
>
> A web application with a **backend** and a **frontend** that work together.
>
> [Image "User flow: what the traveler does", titled "User flow - Build My Holiday". 1. Enter the trip: departure city, country, first day, nights, travelers, budget. From 1 to 2. See the package: cities chosen by the app, flights, hotels, transfers, day-by-day plan, total. From 2, "not happy yet", to 3. Change something: hotel, flight, add or remove attractions. From 3, "rules checked again", back to 2. From 2, "happy", to 4. Confirm: get a 10-digit reservation number. From 4 to 5. Reservation summary: open it again by its number. From 1 to No package fits: say why, show the cheapest total. From there, "edit the trip", back to 1.]
>
> ---
>
> ## 3. Inputs you receive
>
> | File | What it is |
> |---|---|
> | `data/catalog/destinations.json` | Departure cities, destination countries (Japan, United Arab Emirates), their cities, and the transfers between cities |
> | `data/catalog/airports.json` | Airports, time zones, and the cities each airport serves |
> | `data/catalog/flights.json` | Flights between India and Japan or the UAE: local times, price per seat, seats left |
> | `data/catalog/hotels.json`, `rooms.json`, `availability.json` | Hotels, room types (who fits, price per night), and rooms left per night |
> | `data/catalog/transfers.json` | Airport taxis and buses, transfers between cities, and city taxis |
> | `data/catalog/attractions.json` | Attractions: opening days and hours, closed dates, visit time, prices |
> | `images/` | Photos. If you show them, also show the credits in `images/ATTRIBUTIONS.md`. |
>
> `DATA_DICTIONARY.md` explains every field. Flights and rooms exist from **1 to 20 April 2027** only.
>
> ---
>
> ## 4. Travel rules
>
> A package is correct only if every rule is true. Judges check every rule.
>
> **Dates and cities**
>
> - The trip is 3 to 10 nights. The first night is on or after 1 April 2027, and the return flight is on or before 20 April 2027.
> - All cities are in the chosen country. Your app chooses the cities, their order, and the nights in each.
> - Each city has at least 2 nights in a row, and appears once in the plan.
>
> **Flights**
>
> - One arrival flight from the departure city and one return flight to it.
> - The arrival flight lands on the holiday start date (local time) at an airport that serves the first city (`serves_cities`).
> - The return flight leaves on the last day (local time) from an airport that serves the last city.
> - Every traveler, including each child, needs a seat: `seats_left` ≥ travelers.
>
> **Airport transfers**
>
> - One transfer from the arrival airport to the first hotel, and one from the last hotel to the return airport. The transfer serves the hotel's city and area.
> - The pickup is at least 60 minutes after landing.
> - The traveler reaches the airport at least 180 minutes before departure.
> - The pickup time, and the time to leave the hotel, are inside the service hours.
>
> **Transfers between cities**
>
> - On each day the traveler moves to the next city, one transfer from the old city to the new city (`from_city`, `to_city`), inside its service hours. City taxis to and from stations are optional.
>
> **Hotels**
>
> - One hotel for every night. No hotel night on the last day.
> - In each city, one hotel and one room type for all nights. Several rooms of that type are fine.
> - `k` rooms fit the travelers if adults ≤ k × `max_adults`, adults + children ≤ k × (`max_adults` + `max_children`), and adults ≥ k.
> - `rooms_left` ≥ `k` on every night of the stay.
>
> **Attractions**
>
> - An attraction is in the city of that night's hotel, is open that day, and the visit fits inside the opening hours.
> - Visits on the same day do not overlap. Each attraction is in the package at most once.
> - The first package has 1–2 attractions on every full day.
> - On the arrival day and on a city-change day, attractions are optional and start after the traveler reaches the city. No attractions on the last day.
>
> **Prices**
>
> | Part | Price |
> |---|---|
> | Flight | `price_per_seat` × travelers |
> | Hotel | `price_per_night` × rooms × nights |
> | Transfer, `PER_PERSON` | adults × `price` + children × `child_price` (or `price` if there is none) |
> | Transfer, `PER_VEHICLE` | `price` × vehicles, where vehicles = travelers ÷ `max_passengers`, rounded up |
> | Attraction | adults × `price_per_person` + children × `child_price` (or `price_per_person` if there is none) |
>
> - All prices in the data are INR. The total is the sum of all parts.
> - A child is anyone aged 0 to 17. Judges accept up to 1% difference per price from rounding.
>
> ---
>
> ## 5. Features
>
> The Must-have features are your priority. A single correct package that passes all rules is better than three broken packages. Good-to-have and Stretch features earn extra credit only after all Must features work correctly. Budget your time accordingly.
>
> ### Must have
>
> | # | Feature | Done when |
> |---|---|---|
> | M1 | **Request form** | The form has the 7 request fields. Departure cities and countries come from `destinations.json`. A value that is not valid shows a clear message. |
> | M2 | **Build one package** | The app chooses the city plan and builds a complete package. When no package is possible, the app says so and says why. |
> | M3 | **Rules are respected** | Every rule in section 4 is true for the package. |
> | M4 | **Day-by-day plan** | The package shows each day in time order: flights, transfers, hotels, and attractions. |
> | M5 | **Total and budget** | The app shows the total in INR, the budget, and the amount left or over. The package can be exported as JSON (section 6). |
> | M6 | **Change the package** | The traveler can change the system selected hotel in a city, change a flight, and add or remove attractions. The app checks the whole package again and updates the total, or refuses the change with a reason. |
> | M7 | **Confirm and reservation summary** | Confirm gives a unique 10-digit reservation number. The number opens a summary of the whole package, also after a backend restart. A wrong number shows "not found". |
> | M8 | **Budget too small** | When no package fits the budget, the app says so, shows the cheapest total, and suggests a change. |
>
> ### Good to have
>
> | # | Feature | Done when |
> |---|---|---|
> | G1 | **Changes that affect other parts** | After a change, the app fixes or warns about the other booking it affects. Example: Attractions must not have conflicting times or double bookings or a flight change should pop up about the accommodation check in times. |
> | G2 | **Price difference** | Each change option shows the difference against the current choice. |
> | G3 | **Change cities** | The traveler can choose another valid city plan, and the app builds the package again. |
> | G4 | **Three packages** | The app offers the **cheapest** (lowest total price), the **fastest** (least total travel time: sum of flight durations + all transfer durations between cities), and the **best rated** (highest average hotel `stars` per night, within budget; the guest `rating` does not count). On a tie, show either one. The traveler picks one. |
>
> ### Stretch
>
> | # | Feature | Done when |
> |---|---|---|
> | S1 | **Quick request** | The traveler types a short request in plain words. Your code reads it with rules (no AI) and fills the form. |
> | S2 | **Booking uses up seats and rooms** | A confirmed reservation reduces seats and rooms in your app's own store. A booking that needs the same last seats or rooms is refused. |
> | S3 | **Your own idea** | Any other feature that makes the holiday easier to plan or book. |
>
> ---
>
> ## 6. Package export (JSON file)
>
> Your app downloads the package as one JSON file. During the demo, the judges load it into a tool that checks every rule in section 4.
>
> Use the **shared trip format** in `DATA_DICTIONARY.md`, section 4. `data/trip_format_example.json` is a short example. For this problem, also set `country`, and give hotel items a `room_id`. After confirm, set `status` to `BOOKED` and `booking.reference` to the reservation number as a string.
>
> ---
>
> ## 7. Technical rules
>
> | Rule | Detail |
> |---|---|
> | Any stack | Any language, framework, and database |
> | Catalog only | Every flight, hotel, transfer, attraction, price, and opening time comes from `data/catalog/`. Do not change the data files. |
> | Backend holds the logic | Choosing cities, building the package, rule checks, and prices run in the backend. The frontend gets all data from your backend API. |
> | State is saved | Packages and reservations survive a page refresh and a backend restart. |
> | No AI inside the app | Your app must not call an AI or LLM model (cloud or local). AI tools to help you write code are allowed. |
> | Start in 1–2 commands | Write the commands in your README. |
> | Build during the event | Templates and open-source libraries are allowed. Feature code is written during the event. We check the Git history. |
>
> ---
>
> ## 8. How we judge
>
> | Area | Weight |
> |---|---|
> | Working end-to-end feature (Must / Good / Stretch reached) | 25% |
> | Correctness on new requests and changes given by the judges | 25% |
> | Individual understanding (questions to each member, one small live code change) | 20% |
> | Product and user experience | 15% |
> | Engineering quality (code structure, data model, README, Git history) | 15% |
>
> The judges enter **requests you have not seen**: other departure cities, the other country, other dates, travelers, and budgets. There is no single correct package. A package that breaks one rule is wrong, even if it looks good.
>
> | The request has... | Your app must... |
> |---|---|
> | A package within budget | Build a correct package |
> | Packages, but none within budget | Say so (M8) |
> | No possible package | Say so, with the reason (M2) |
> | A value that is not valid | Show a clear message (M1) |
>
> ---
>
> ## 9. Demo and submission
>
> **Demo (12 minutes):** 4 minutes live demo with the Menon request (build, change, confirm, open the reservation), 3 minutes of judge requests, 4 minutes of questions, 1 minute changeover. Before your slot: app running, form empty.
>
> **Submission:**
>
> 1. Push your code to your Git repository every hour.
> 2. At code freeze, upload a zip file to HackerEarth with your source code, `README.md`, and setup scripts. No `node_modules`, virtual environments, build output, or API keys.
> 3. The `README.md` says how to start the app, the architecture, your city rule, what you finished, and known limitations.
>
> ---
>
> ## 10. FAQ
>
> **Can we use AI tools to write code?** Yes. You must understand and explain all your code.
>
> **Is "confirm" a real booking?** No. Confirm saves the reservation in your app. There is no payment, and the data files do not change.
>
> **Must the package be the cheapest?** No. It must be correct, and within budget when possible.
>
> **Do we need user login or payments?** No.
>
> **Must we deploy the app online?** No. It runs on your laptop for the demo.
>
> **Can the arrival and return airports be different?** Yes, if each airport serves the right city.
>
> **Are one-stop flights allowed?** Yes.
>
> **Can the app show more than one package?** Yes. The traveler picks one.
>
> **Do judges check hotel check-in and check-out times?** No. They are for display only.
>
> **Do we need city taxis on a city-change day?** No. If you add them, add their price.
>
> **Can we change the data files?** No. Judges use the original files.
>
> **Where do we ask questions?** At the help desk or in the event chat channel. We send every answer to all teams.

</details>

## In plain words

**Who:** a family in India planning a first holiday abroad. The example is the Menon family from Bengaluru: 2 adults and a child aged 6, going to Japan.

**Their situation:** a holiday abroad has flights, hotels, airport transfers, transfers between cities and attractions. Each part has to fit the others in time, place, capacity and price, and when one part changes, others often stop fitting. The family knows where they start, the country, the dates, who travels and the budget, but not which cities to visit.

**What they need:** to enter 7 facts and get one complete package in which every rule holds, with the cities chosen for them. Then to see it day by day with the total against the budget, change the hotel, a flight or the attractions and have the whole package checked again, and confirm to get a 10-digit reservation number that reopens the package later.

**Why it matters:** a package that breaks one rule is wrong, even if it looks good. Judges check every rule, also on requests and changes the team has not seen.

## Rules

| Rule | Exact numbers and boundaries | Source |
| ---- | ---------------------------- | ------ |
| Request | 7 fields: departure city, destination country, holiday start date, nights, adults, children's ages, budget. Departure cities and countries come from `destinations.json`. A value that is not valid gets a clear message | M1 |
| Trip length | 3 to 10 nights, both included (`rules.min_nights`, `rules.max_nights` in `destinations.json`) | §4 |
| Data window | First night on or after 1 Apr 2027. Return flight on or before 20 Apr 2027 (`rules.data_window`). Flights and rooms exist only from 1 to 20 Apr 2027. A request outside the window has no package: say so | §3, §4, dictionary FAQ |
| Start date, last day | Start date = the day the arrival flight lands, in local time. The flight may leave India the evening before. Last day = start date + nights: the return flight leaves that day, with no hotel night and no attractions | §1, §4 |
| Cities | All in the chosen country. The app chooses the cities, their order and the nights in each. Each city has at least 2 nights in a row (`rules.min_nights_per_city`) and appears once | §4 |
| Flights | One arrival flight from the departure city's airport and one return flight to it. The arrival lands on the start date (local time) at an airport whose `serves_cities` has the first city. The return leaves on the last day (local time) from an airport that serves the last city. The two airports may differ. One-stop flights are allowed | §4, FAQ |
| Seats | `seats_left` ≥ travelers. Travelers = adults + children, and every child needs a seat | §4 |
| Airport transfers | One from the arrival airport to the first hotel, and one from the last hotel to the return airport. The transfer's `airport` is the flight's airport, and it serves the hotel's city and area (`area: null` serves every area). Airport transfers run in both directions | §4, dictionary §3 |
| Transfer times | Pickup at least 60 minutes after landing. At the airport at least 180 minutes before departure. The pickup, and the time the traveler leaves the hotel, inside `service_from` to `service_until` | §4 |
| Clock values | Local time of the place, with no UTC offset. Both ends of a window are included. `24:00` is midnight at the end of the day. A window like `06:00` to `00:30` runs past midnight | dictionary §5 |
| Between cities | On each city-change day, one transfer with `from_city` = the old city and `to_city` = the new one, from that link's `transfer_ids`, inside its service hours. Trains and intercity buses leave every `frequency_minutes` inside the window. City taxis to and from stations are optional, and are priced if added | §4, dictionary §3, FAQ |
| Hotel nights | One hotel for every night from the start date to the day before the last day. A night is the date you sleep there: check-in 11, check-out 15 = nights 11, 12, 13, 14 | §4, dictionary §5 |
| Hotel per city | One hotel and one room type for all nights in a city. Several rooms of that type are fine | §4 |
| Room fit | k rooms fit if adults ≤ k × `max_adults`, adults + children ≤ k × (`max_adults` + `max_children`), and adults ≥ k. Example: 2 adults + 1 child fit 2 `TWIN` or 1 `FAMILY` | §4, dictionary §3 |
| Rooms left | `rooms_left` ≥ k on every night of the stay | §4 |
| Attractions | In the city of that night's hotel, open that weekday (`open_days`), date not in `closed_dates`, and the whole visit (start to start + `visit_minutes`) inside the opening hours. Visits on the same day don't overlap. Each attraction appears at most once | §4 |
| Attractions per day | The first package has 1–2 on every full day. On the arrival day and city-change days they are optional and start after the traveler reaches the city. None on the last day | §4 |
| Prices | Flight: `price_per_seat` × travelers (children pay the same). Hotel: `price_per_night` × rooms × nights. Transfer `PER_PERSON`: adults × `price` + children × `child_price` (or `price` if there is none). Transfer `PER_VEHICLE`: `price` × ⌈travelers ÷ `max_passengers`⌉. Attraction: adults × `price_per_person` + children × `child_price` (or `price_per_person` if there is none). Total = sum of all parts | §4, dictionary FAQ |
| Money | All INR, whole rupees. Judges accept up to 1% difference per price | §4 |
| Child | Anyone aged 0 to 17 | §4 |
| Budget | Show the total, the budget and the amount left or over. The package need not be the cheapest, but must be within budget when possible. When none fits: say so, show the cheapest total, suggest a change | M5, M8, FAQ |
| No package | Say so, and say why | M2, §8 |
| Changes | Change the hotel in a city, change a flight, add or remove attractions. Then check the whole package again and update the total, or refuse the change with a reason | M6 |
| Confirm | A unique 10-digit reservation number that opens a summary of the whole package, also after a backend restart. A wrong number shows "not found". No payment, and the data files don't change | M7, FAQ |
| Saved state | Packages and reservations survive a page refresh and a backend restart | §7 |
| Export | One JSON file in the shared trip format (`DATA_DICTIONARY.md` §4), plus `country`, and a `room_id` on hotel items. After confirm, `status` is `BOOKED` and `booking.reference` is the number as a string. Local times as `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`. `sources` is always `[]`. Judges load it into a tool that checks every rule | §6, dictionary §4 |
| Three packages (G4) | Cheapest: lowest total. Fastest: the 2 flights' `duration_minutes` plus every between-cities transfer's `duration_minutes` (airport transfers and city taxis don't count). Best rated: highest average hotel `stars` per night, within budget; guest `rating` doesn't count. On a tie, either | G4, dictionary FAQ |
| Technical | Catalog data only, files unchanged. Choosing cities, building, rule checks and prices run in the backend, and the frontend gets all data from the backend API. No AI or LLM call inside the app. Starts with 1–2 commands written in the README. Feature code is written during the event and the Git history is checked. Templates and open-source libraries are allowed | §7 |
| Submission | Push every hour. At code freeze, a zip on HackerEarth with source, `README.md` and setup scripts, without `node_modules`, virtual environments, build output or keys. The README says how to start the app, the architecture, the city rule, what is finished and known limitations | §9 |

**Must be shown (12-minute slot):** 4 minutes live with the Menon request (build, change, confirm, open the reservation), 3 minutes of judge requests, 4 minutes of questions, 1 minute changeover. Before the slot: app running, form empty.

**Judged on:** working end-to-end feature 25%, correctness on new requests and changes 25%, individual understanding (questions to each member, one small live code change) 20%, product and user experience 15%, engineering quality (code structure, data model, README, Git history) 15%.

## Mentor answers

| Question | Answer |
| -------- | ------ |
| None asked yet | Questions go to the help desk or the event chat. The organisers send every answer to all teams |

## What the data shows

Facts and counts only. They belong here because `data/profile.md` is not committed. Checked on 13 Nov against `data/hackathon-problem-1-holiday-package.zip`.

**Size and quality:** 8 catalog files, about 520 KB: 3,275 records plus the single `destinations.json` object. 0 unreadable records, 0 duplicate IDs, 0 broken references between files, 0 values with stray spaces, and every price is whole INR. All 469 flight durations agree with their local times and time zones. The fields that are sometimes missing are the documented optional ones. The judges use the same files.

| File | Records | Facts |
| ---- | ------- | ----- |
| `destinations.json` | 1 object | 4 departure cities: Bengaluru `BLR`, Delhi `DEL`, Mumbai `BOM`, Chennai `MAA`. Japan: Tokyo (`NRT`, `HND`), Kyoto (`KIX`), Osaka (`KIX`). UAE: Dubai (`DXB`), Abu Dhabi (`AUH`, `DXB`). Links: all 6 one-way pairs of Tokyo, Kyoto and Osaka, 1 train each; Dubai to Abu Dhabi and back, a bus and a taxi each way |
| `airports.json` | 10 | The 4 Indian airports have no `serves_cities`. `ITM` serves no city and has no flights. Kyoto has no airport |
| `flights.json` | 469 | 240 to the destinations (99 to Japan, 141 to the UAE), 229 back (89, 140). Economy only. 9 have one stop, all from `BLR` to Japan. ₹21,420–40,320 a seat for Japan, ₹8,900–20,000 for the UAE. `seats_left` 1–9 |
| `hotels.json` | 49 | Tokyo 13, Kyoto 12, Osaka 10, Dubai 8, Abu Dhabi 6, in 23 areas. Stars 2–5 |
| `rooms.json` | 125 | 1–3 per hotel. Capacity in adults + children: `TWIN` 48 (2 + 0), `FAMILY` 31 (2 + 2), `SINGLE` 14 (1 + 0), `FAMILY_SUITE` 12 (4 + 2), `DOUBLE` 11 (2 + 0), `TRIPLE` 9 (3 + 0). ₹2,576–61,830 a night |
| `availability.json` | 2,500 | Every room type on every night from 1 to 20 Apr (125 × 20). `rooms_left` 0–8. 61 room-nights are full, spread over 47 room types |
| `transfers.json` | 66 | 50 airport transfers (26 taxis, 23 buses, 1 van; 5 of them serve every area of their city), 10 between cities (6 trains every 30 minutes, 2 buses, 2 taxis), 6 inside a city |
| `attractions.json` | 56 | Tokyo 15, Kyoto 12, Dubai 11, Osaka 9, Abu Dhabi 7, Nara 2. Nara has no hotels |

**The Menon request** (from `BLR` to Japan, landing Sat 10 Apr 2027, flying home Fri 16 Apr, 3 seats):

| Fact | Value |
| ---- | ----- |
| Arrival flights landing on 10 Apr | 4. `FL-403` to `HND`: ₹21,420 a seat, but only 2 seats left. `FL-401` to `NRT`: ₹25,200. `FL-740` to `KIX`: ₹34,440. `FL-405` to `NRT`: ₹23,940, one stop, leaves `BLR` at 06:30 and lands at 21:30 the same day |
| Return flights on 16 Apr | 2. `FL-412` from `HND` at 11:00: ₹26,880. `FL-411` from `KIX` at 12:00: ₹26,040 |
| Cheapest flights for 3 seats | ₹1,49,940 |
| Room types that fit 2 adults + 1 child | Tokyo 31, Kyoto 27, Osaka 20 (some need 2 rooms), from ₹8,008 a night. `SINGLE` never fits |

**Edges in the data:**

| Fact | Detail |
| ---- | ------ |
| Days without flights | Chennai: no landing in Japan on 2, 6, 10, 14, 18 Apr, no flight home on 3, 7, 11, 15, 19. Mumbai: no landing on 3, 7, 11, 15, 19, none home on 4, 8, 12, 16, 20. Delhi: no landing on 4, 8, 12, 16, 20, none home on 1, 5, 13, 17. Bengaluru to Japan and every city to the UAE fly every day, both ways |
| Late landings | All 9 one-stop flights land between 20:30 and 22:50. After the 5 that land at `KIX` between 22:10 and 22:50, 1 of the 10 `KIX` airport transfers is still running: the `06:00`–`00:30` shuttle to Namba, Osaka |
| Few seats | 4 flights have fewer than 3 seats: `FL-990`, `FL-403`, `FL-601`, `FL-205` |
| Clock values | 22 transfers end at `24:00`. 1 runs past midnight (`06:00`–`00:30`). 3 attractions are open `00:00`–`24:00` |
| Closures | 11 attractions close on one weekday or two, 7 of them on Monday (12 Apr 2027 is a Monday). `closed_dates`: Edo Craft Museum 10–20 Apr, Tokyo Disneyland 12 Apr, Heritage Village 12 Apr, Museum of the Future 14 Apr |
| Long visits | Universal Studios Japan and Tokyo Disneyland take 480 minutes and open 09:00–21:00 |
| Child prices | `child_price` is 0 on 5 attractions (children go free) and missing on 25 (children pay the adult price). 24 attractions are free for adults |
| Never usable | Nara's 2 attractions, because Nara has no hotels. `ITM` |
| Export example | `trip_format_example.json` matches the catalog (`FL-401`; `HTL-KYO-004` with `RM-KYO-004-B` at ₹8,120 a night) but has no `country`, which §6 requires. Catalog times have seconds (`2027-04-09T23:50:00`); the export format has minutes (`2027-04-09T23:50`) |

## Out of scope

Stated: user login, payments, deploying online, a real booking (confirm only saves in our app, and the data files don't change), currency conversion (all prices are INR), AI or LLM calls inside the app, and hotel check-in and check-out times (display only, judges don't check them). City taxis on a city-change day are not needed.

Never mentioned: cancelling or changing a reservation after confirm, traveler names or contact details (the export has `traveler.name`, but the form has no name field), and visas.

## Left to us

Questions nobody has settled. List them without answers.

- How does the app choose the cities, their order and the nights in each? (The README must state "your city rule".)
- Which package is built first when several are valid?
- What does "suggests a change" mean when nothing fits the budget?
- What happens when the traveler picks a flight at an airport that does not serve the current first or last city?
- After a change breaks another part (G1), does the app fix it or warn?
- Does "1–2 attractions on every full day" still hold after the traveler adds or removes attractions?
- On the arrival day and a city-change day, when has the traveler "reached the city": at the airport or station, or at the hotel?
- After a late landing, may the airport pickup fall on the next calendar day?
- Which departure time is chosen for trains and buses that leave every 30 minutes?
- Is a total exactly equal to the budget within budget?
- Must the cheapest and fastest packages (G4) also be within budget?
- Is a request that breaks a trip rule (2 nights, 11 nights) an invalid value (M1) or a request with no possible package (M2)?
- What counts as invalid input: a child aged 18 or more, no adults, more travelers than any flight has seats?
- Can a confirmed reservation still be changed?
- May a reservation number start with 0, and does a malformed number also show "not found"?
- What goes in the export's `traveler.name`?
- Are hotel and attraction photos shown? (If so, the credits in `images/ATTRIBUTIONS.md` must be shown too.)
