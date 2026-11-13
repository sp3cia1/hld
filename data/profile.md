# Data profile

- Source: `/Users/upadhyay5/Desktop/personal/bh/hld/data/raw/hackathon-problem-1-holiday-package/data`
- Generated: 2026-11-13T06:31:14.959Z
- Files: 9 · Rows: 3,283
- Empty text, `null`, `N/A` and `NaN` count as null. Text like `007` stays a string.

## Overview

| file | format | rows | columns | size | unreadable rows |
| --- | --- | --- | --- | --- | --- |
| `catalog/airports.json` | json | 10 | 8 | 2.1 KB | 0 |
| `catalog/attractions.json` | json | 56 | 20 | 35.5 KB | 0 |
| `catalog/availability.json` | json | 2,500 | 3 | 210.0 KB | 0 |
| `catalog/destinations.json` | json | 6 | 7 | 2.5 KB | 0 |
| `catalog/flights.json` | json | 469 | 13 | 178.7 KB | 0 |
| `catalog/hotels.json` | json | 49 | 13 | 17.0 KB | 0 |
| `catalog/rooms.json` | json | 125 | 9 | 33.0 KB | 0 |
| `catalog/transfers.json` | json | 66 | 21 | 32.9 KB | 0 |
| `trip_format_example.json` | json | 2 | 14 | 1.0 KB | 0 |

## `catalog/airports.json`

Format: json · Size: 2.1 KB · Rows: 10 · Columns: 8

- Every row has a different value in: `code`, `name` (candidates for a natural key)

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | string | 0% | 10 |  |  |  |
| `name` | string | 0% | 10 |  |  |  |
| `city` | string | 0% | 8 |  |  | Osaka (2), Tokyo (2), Bengaluru (1), Delhi (1), Mumbai (1), Chennai (1), Dubai (1), Abu Dhabi (1) |
| `country` | string | 0% | 3 |  |  | IN (4), JP (4), AE (2) |
| `timezone` | string | 0% | 3 |  |  | Asia/Kolkata (4), Asia/Tokyo (4), Asia/Dubai (2) |
| `lat` | number | 0% | 10 | 12.9941 | 35.772 |  |
| `lng` | number | 0% | 10 | 54.6511 | 140.3929 |  |
| `serves_cities` | array | 40% | 5 |  |  | ["Tokyo"] (2), ["Osaka","Kyoto"] (1), [] (1), ["Dubai","Abu Dhabi"] (1), ["Abu Dhabi"] (1) |

Sample rows (first 3):

```json
{"code":"BLR","name":"Kempegowda International Airport","city":"Bengaluru","country":"IN","timezone":"Asia/Kolkata","lat":13.1986,"lng":77.7066}
{"code":"DEL","name":"Indira Gandhi International Airport","city":"Delhi","country":"IN","timezone":"Asia/Kolkata","lat":28.5562,"lng":77.1}
{"code":"KIX","name":"Kansai International Airport","city":"Osaka","country":"JP","timezone":"Asia/Tokyo","lat":34.432,"lng":135.2304,"serves_cities":["Osaka","Kyoto"]}
```

## `catalog/attractions.json`

Format: json · Size: 35.5 KB · Rows: 56 · Columns: 20

- Every row has a different value in: `attraction_id`, `name`, `image` (candidates for a natural key)

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `attraction_id` | string | 0% | 56 |  |  |  |
| `name` | string | 0% | 56 |  |  |  |
| `name_ja` | string | 32% | 38 |  |  |  |
| `city` | string | 0% | 6 |  |  | Tokyo (15), Kyoto (12), Dubai (11), Osaka (9), Abu Dhabi (7), Nara (2) |
| `category` | string | 0% | 15 |  |  | MUSEUM (9), DISTRICT (6), TEMPLE (5), MARKET (5), VIEWPOINT (5), PARK (5), THEME_PARK (4), SHRINE (3), NATURE (3), AQUARIUM (3) |
| `lat` | number | 0% | 55 | 24.412 | 35.7228 |  |
| `lng` | number | 0% | 55 | 54.306 | 139.8804 |  |
| `open_days` | array | 0% | 6 |  |  | ["MON","TUE","WED","THU","FRI","SAT","S… (45), ["TUE","WED","THU","FRI","SAT","SUN"] (7), ["THU","FRI","SAT","SUN","MON","TUE"] (1), ["FRI","SAT","SUN","MON","TUE","WED"] (1), ["MON","TUE","THU","FRI","SAT"] (1), ["SAT","SUN","MON","TUE","WED","THU"] (1) |
| `open_from` | string | 0% | 13 |  |  | 09:00 (16), 10:00 (16), 06:00 (6), 09:30 (4), 07:00 (3), 00:00 (3), 08:00 (2), 08:45 (1), 06:30 (1), 07:30 (1) |
| `open_until` | string | 0% | 15 |  |  | 17:00 (11), 22:00 (9), 23:00 (6), 21:00 (6), 18:00 (5), 20:00 (4), 16:00 (3), 24:00 (3), 19:00 (2), 17:30 (2) |
| `aliases` | array | 0% | 29 |  |  |  |
| `visit_minutes` | integer | 0% | 8 | 30 | 480 | 60 (20), 90 (16), 120 (9), 45 (3), 150 (3), 480 (2), 180 (2), 30 (1) |
| `child_friendly` | boolean | 0% | 2 |  |  | true (52), false (4) |
| `accessible` | boolean | 0% | 2 |  |  | true (51), false (5) |
| `price_per_person.amount` | integer | 0% | 26 | 0 | 5725 |  |
| `price_per_person.currency` | string | 0% | 1 |  |  | INR (56) |
| `image` | string | 0% | 56 |  |  |  |
| `child_price.amount` | integer | 45% | 22 | 0 | 5038 | 0 (5), 224 (3), 168 (2), 3136 (2), 392 (2), 112 (1), 280 (1), 672 (1), 784 (1), 840 (1) |
| `child_price.currency` | string | 45% | 1 |  |  | INR (31) |
| `closed_dates` | array | 93% | 3 |  |  | ["2027-04-12"] (2), ["2027-04-10","2027-04-11","2027-04-12"… (1), ["2027-04-14"] (1) |

Sample rows (first 3):

```json
{"attraction_id":"ATT-KYO-001","name":"Kiyomizu-dera","name_ja":"清水寺","city":"Kyoto","category":"TEMPLE","lat":34.9949,"lng":135.785,"open_days":["MON","TUE","WED","THU","FRI","SAT","SUN"],"open_from":"06:00","open_until":"18:00","aliases":["Kiyomizu Temple"],"visit_minutes":90,"child_friendly":true,"accessible":false,"price_per_person":{"amount":280,"currency":"INR"},"image":"images/attractions/ATT-KYO-001.jpg","child_price":{"amount":112,"currency":"INR"}}
{"attraction_id":"ATT-KYO-002","name":"Fushimi Inari Taisha","name_ja":"伏見稲荷大社","city":"Kyoto","category":"SHRINE","lat":34.9671,"lng":135.7727,"open_days":["MON","TUE","WED","THU","FRI","SAT","SUN"],"open_from":"06:00","open_until":"19:00","aliases":["Fushimi Inari","Fushimi Inari Shrine"],"visit_minutes":120,"child_friendly":true,"accessible":false,"price_per_person":{"amount":0,"currency":"INR"},"image":"images/attractions/ATT-KYO-002.jpg"}
{"attraction_id":"ATT-KYO-003","name":"Kinkaku-ji","name_ja":"金閣寺","city":"Kyoto","category":"TEMPLE","lat":35.0394,"lng":135.7292,"open_days":["MON","TUE","WED","THU","FRI","SAT","SUN"],"open_from":"09:00","open_until":"17:00","aliases":["Golden Pavilion","Rokuon-ji"],"visit_minutes":60,"child_friendly":true,"accessible":true,"price_per_person":{"amount":280,"currency":"INR"},"image":"images/attractions/ATT-KYO-003.jpg","child_price":{"amount":168,"currency":"INR"}}
```

## `catalog/availability.json`

Format: json · Size: 210.0 KB · Rows: 2,500 · Columns: 3

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `room_id` | string | 0% | 125 |  |  |  |
| `date` | date | 0% | 20 | 2027-04-01 | 2027-04-20 | 2027-04-01 (125), 2027-04-02 (125), 2027-04-03 (125), 2027-04-04 (125), 2027-04-05 (125), 2027-04-06 (125), 2027-04-07 (125), 2027-04-08 (125), 2027-04-09 (125), 2027-04-10 (125) |
| `rooms_left` | integer | 0% | 8 | 0 | 8 | 6 (359), 2 (357), 5 (356), 4 (353), 7 (347), 8 (340), 3 (327), 0 (61) |

Sample rows (first 3):

```json
{"room_id":"RM-TYO-001-A","date":"2027-04-01","rooms_left":7}
{"room_id":"RM-TYO-001-A","date":"2027-04-02","rooms_left":6}
{"room_id":"RM-TYO-001-A","date":"2027-04-03","rooms_left":5}
```

## `catalog/destinations.json`

Format: json · Size: 2.5 KB · Rows: 6 · Columns: 7

- Note: Several arrays at the top level (`departure_cities`, `countries`). Their elements are merged here. Split them if they differ.

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `airport` | string | 33% | 4 |  |  |  |
| `city` | string | 33% | 4 |  |  |  |
| `code` | string | 67% | 2 |  |  |  |
| `name` | string | 67% | 2 |  |  |  |
| `timezone` | string | 67% | 2 |  |  |  |
| `cities` | array | 67% | 2 |  |  |  |
| `links` | array | 67% | 2 |  |  |  |

Sample rows (first 3):

```json
{"airport":"BLR","city":"Bengaluru"}
{"airport":"DEL","city":"Delhi"}
{"airport":"BOM","city":"Mumbai"}
```

## `catalog/flights.json`

Format: json · Size: 178.7 KB · Rows: 469 · Columns: 13

- Every row has a different value in: `flight_id` (candidates for a natural key)

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `flight_id` | string | 0% | 469 |  |  |  |
| `airline` | string | 0% | 3 |  |  | AirVeda (236), Sandline Airways (139), Nippon Sky (94) |
| `flight_number` | string | 0% | 413 |  |  |  |
| `from` | string | 0% | 9 |  |  | BLR (92), DXB (80), AUH (60), BOM (55), DEL (48), MAA (45), KIX (36), HND (27), NRT (26) |
| `to` | string | 0% | 9 |  |  | BLR (82), DXB (81), AUH (60), BOM (55), DEL (47), MAA (45), KIX (43), NRT (31), HND (25) |
| `departure_local` | date | 0% | 286 | 2027-03-31T20:00:00 | 2027-04-20T22:00:00 |  |
| `arrival_local` | date | 0% | 440 | 2027-04-01T04:50:00 | 2027-04-21T03:45:00 |  |
| `stops` | integer | 0% | 2 | 0 | 1 | 0 (460), 1 (9) |
| `duration_minutes` | integer | 0% | 42 | 185 | 690 |  |
| `price_per_seat.amount` | integer | 0% | 57 | 8900 | 40320 |  |
| `price_per_seat.currency` | string | 0% | 1 |  |  | INR (469) |
| `seats_left` | integer | 0% | 8 | 1 | 9 | 9 (99), 6 (94), 8 (77), 5 (71), 4 (64), 7 (60), 2 (3), 1 (1) |
| `cabin` | string | 0% | 1 |  |  | ECONOMY (469) |

Sample rows (first 3):

```json
{"flight_id":"FL-1001","airline":"Nippon Sky","flight_number":"NS 432","from":"DEL","to":"HND","departure_local":"2027-03-31T20:00:00","arrival_local":"2027-04-01T07:20:00","stops":0,"duration_minutes":470,"price_per_seat":{"amount":36000,"currency":"INR"},"seats_left":4,"cabin":"ECONOMY"}
{"flight_id":"FL-1004","airline":"AirVeda","flight_number":"AV 846","from":"MAA","to":"NRT","departure_local":"2027-03-31T21:00:00","arrival_local":"2027-04-01T07:50:00","stops":0,"duration_minutes":440,"price_per_seat":{"amount":31000,"currency":"INR"},"seats_left":8,"cabin":"ECONOMY"}
{"flight_id":"FL-702","airline":"AirVeda","flight_number":"AV 771","from":"BLR","to":"KIX","departure_local":"2027-03-31T21:40:00","arrival_local":"2027-04-01T09:20:00","stops":0,"duration_minutes":490,"price_per_seat":{"amount":27720,"currency":"INR"},"seats_left":4,"cabin":"ECONOMY"}
```

## `catalog/hotels.json`

Format: json · Size: 17.0 KB · Rows: 49 · Columns: 13

- Every row has a different value in: `hotel_id`, `name` (candidates for a natural key)

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `hotel_id` | string | 0% | 49 |  |  |  |
| `name` | string | 0% | 49 |  |  |  |
| `aliases` | array | 0% | 1 |  |  | [] (49) |
| `city` | string | 0% | 5 |  |  | Tokyo (13), Kyoto (12), Osaka (10), Dubai (8), Abu Dhabi (6) |
| `area` | string | 0% | 23 |  |  | Namba (4), Ginza (3), Shinjuku (3), Umeda (3), Higashiyama (3), Kyoto Station (3), Kawaramachi (3), Corniche (3), Asakusa (2), Shinagawa (2) |
| `lat` | number | 0% | 48 | 24.4764 | 35.712 |  |
| `lng` | number | 0% | 48 | 54.3366 | 139.796 |  |
| `rating` | number | 0% | 24 | 6.9 | 9.4 | 8 (5), 8.6 (3), 8.1 (3), 8.4 (3), 7.9 (3), 8.3 (3), 8.7 (3), 7.6 (3), 8.2 (2), 9.1 (2) |
| `stars` | integer | 0% | 4 | 2 | 5 | 3 (18), 4 (17), 2 (7), 5 (7) |
| `check_in_from` | string | 0% | 2 |  |  | 15:00 (35), 14:00 (14) |
| `check_out_until` | string | 0% | 2 |  |  | 11:00 (35), 12:00 (14) |
| `family_friendly` | boolean | 0% | 2 |  |  | true (36), false (13) |
| `image` | string | 0% | 10 |  |  | images/hotels/HOTEL-BUSINESS-1.jpg (13), images/hotels/HOTEL-BUSINESS-2.jpg (11), images/hotels/HOTEL-TWIN-1.jpg (6), images/hotels/HOTEL-TWIN-2.jpg (5), images/hotels/HOTEL-FAMILY-1.jpg (4), images/hotels/HOTEL-LUXURY-1.jpg (4), images/hotels/HOTEL-LUXURY-2.jpg (2), images/hotels/HOTEL-RYOKAN-1.jpg (2), images/hotels/HOTEL-CAPSULE-1.jpg (1), images/hotels/HOTEL-RYOKAN-2.jpg (1) |

Sample rows (first 3):

```json
{"hotel_id":"HTL-TYO-001","name":"Ginza Pearl Hotel","aliases":[],"city":"Tokyo","area":"Ginza","lat":35.6717,"lng":139.765,"rating":8.6,"stars":4,"check_in_from":"15:00","check_out_until":"11:00","family_friendly":true,"image":"images/hotels/HOTEL-TWIN-1.jpg"}
{"hotel_id":"HTL-TYO-002","name":"Ginza Willow Hotel","aliases":[],"city":"Tokyo","area":"Ginza","lat":35.6681,"lng":139.7683,"rating":8.1,"stars":3,"check_in_from":"15:00","check_out_until":"11:00","family_friendly":true,"image":"images/hotels/HOTEL-BUSINESS-1.jpg"}
{"hotel_id":"HTL-TYO-003","name":"Asakusa River Hotel","aliases":[],"city":"Tokyo","area":"Asakusa","lat":35.712,"lng":139.796,"rating":8.4,"stars":3,"check_in_from":"15:00","check_out_until":"11:00","family_friendly":true,"image":"images/hotels/HOTEL-BUSINESS-2.jpg"}
```

## `catalog/rooms.json`

Format: json · Size: 33.0 KB · Rows: 125 · Columns: 9

- Every row has a different value in: `room_id` (candidates for a natural key)

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `room_id` | string | 0% | 125 |  |  |  |
| `hotel_id` | string | 0% | 49 |  |  |  |
| `room_type` | string | 0% | 6 |  |  | TWIN (48), FAMILY (31), SINGLE (14), FAMILY_SUITE (12), DOUBLE (11), TRIPLE (9) |
| `name` | string | 0% | 6 |  |  | Twin Room (48), Family Room (31), Single Room (14), Family Suite (12), Double Room (11), Triple Room (9) |
| `max_adults` | integer | 0% | 4 | 1 | 4 | 2 (90), 1 (14), 4 (12), 3 (9) |
| `max_children` | integer | 0% | 2 | 0 | 2 | 0 (82), 2 (43) |
| `price_per_night.amount` | integer | 0% | 108 | 2576 | 61830 |  |
| `price_per_night.currency` | string | 0% | 1 |  |  | INR (125) |
| `refundable` | boolean | 0% | 2 |  |  | true (86), false (39) |

Sample rows (first 3):

```json
{"room_id":"RM-TYO-001-A","hotel_id":"HTL-TYO-001","room_type":"TWIN","name":"Twin Room","max_adults":2,"max_children":0,"price_per_night":{"amount":6440,"currency":"INR"},"refundable":false}
{"room_id":"RM-TYO-001-B","hotel_id":"HTL-TYO-001","room_type":"FAMILY","name":"Family Room","max_adults":2,"max_children":2,"price_per_night":{"amount":8680,"currency":"INR"},"refundable":true}
{"room_id":"RM-TYO-002-A","hotel_id":"HTL-TYO-002","room_type":"TWIN","name":"Twin Room","max_adults":2,"max_children":0,"price_per_night":{"amount":9240,"currency":"INR"},"refundable":false}
```

## `catalog/transfers.json`

Format: json · Size: 32.9 KB · Rows: 66 · Columns: 21

- Every row has a different value in: `transfer_id`, `name` (candidates for a natural key)

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `transfer_id` | string | 0% | 66 |  |  |  |
| `type` | string | 0% | 8 |  |  | AIRPORT_TAXI (26), AIRPORT_BUS (23), TRAIN (6), CITY_TAXI (5), INTERCITY_BUS (2), INTERCITY_TAXI (2), AIRPORT_VAN (1), CITY_BUS (1) |
| `name` | string | 0% | 66 |  |  |  |
| `airport` | string | 24% | 5 |  |  | NRT (13), HND (12), KIX (10), DXB (10), AUH (5) |
| `city` | string | 15% | 5 |  |  | Tokyo (26), Osaka (9), Dubai (9), Abu Dhabi (8), Kyoto (4) |
| `area` | string | 32% | 18 |  |  | Shinjuku (5), Asakusa (4), Ueno (4), Ginza (4), Shinagawa (4), Shibuya (4), Namba (2), Umeda (2), Shin-Osaka (2), Tennoji (2) |
| `from_point` | string | 0% | 15 |  |  | NRT (13), HND (12), KIX (10), DXB (10), AUH (5), Kyoto Station (3), Tokyo Station (2), Shin-Osaka Station (2), Dubai hotels (2), Abu Dhabi hotels (2) |
| `to_point` | string | 0% | 28 |  |  |  |
| `max_passengers` | integer | 0% | 3 | 4 | 99 | 4 (33), 99 (32), 8 (1) |
| `service_from` | string | 0% | 5 |  |  | 06:00 (25), 00:00 (13), 06:30 (10), 05:00 (9), 05:30 (9) |
| `service_until` | string | 0% | 7 |  |  | 23:00 (25), 24:00 (22), 22:00 (8), 23:30 (5), 21:30 (4), 00:30 (1), 22:30 (1) |
| `duration_minutes` | integer | 0% | 23 | 15 | 150 | 15 (6), 40 (5), 100 (5), 60 (5), 55 (4), 90 (4), 35 (4), 150 (4), 75 (3), 30 (3) |
| `pricing` | string | 0% | 2 |  |  | PER_VEHICLE (34), PER_PERSON (32) |
| `price.amount` | integer | 0% | 40 | 129 | 21280 |  |
| `price.currency` | string | 0% | 1 |  |  | INR (66) |
| `child_price.amount` | integer | 52% | 11 | 67 | 4122 | 364 (7), 896 (6), 344 (6), 448 (3), 3968 (2), 406 (2), 4122 (2), 784 (1), 67 (1), 229 (1) |
| `child_price.currency` | string | 52% | 1 |  |  | INR (32) |
| `from_city` | string | 85% | 5 |  |  | Tokyo (2), Kyoto (2), Osaka (2), Dubai (2), Abu Dhabi (2) |
| `to_city` | string | 85% | 5 |  |  | Kyoto (2), Tokyo (2), Osaka (2), Abu Dhabi (2), Dubai (2) |
| `frequency_minutes` | integer | 88% | 1 | 30 | 30 | 30 (8) |
| `door_to_door` | boolean | 94% | 2 |  |  | false (2), true (2) |

Sample rows (first 3):

```json
{"transfer_id":"TR-NRT-ASA-TAXI","type":"AIRPORT_TAXI","name":"Narita airport taxi to Asakusa","airport":"NRT","city":"Tokyo","area":"Asakusa","from_point":"NRT","to_point":"Asakusa area hotels","max_passengers":4,"service_from":"06:00","service_until":"23:00","duration_minutes":75,"pricing":"PER_VEHICLE","price":{"amount":13440,"currency":"INR"}}
{"transfer_id":"TR-NRT-ASA-BUS","type":"AIRPORT_BUS","name":"Narita limousine bus to Asakusa","airport":"NRT","city":"Tokyo","area":"Asakusa","from_point":"NRT","to_point":"Asakusa area hotels","max_passengers":99,"service_from":"06:30","service_until":"22:00","duration_minutes":95,"pricing":"PER_PERSON","price":{"amount":1792,"currency":"INR"},"child_price":{"amount":896,"currency":"INR"}}
{"transfer_id":"TR-HND-ASA-TAXI","type":"AIRPORT_TAXI","name":"Haneda airport taxi to Asakusa","airport":"HND","city":"Tokyo","area":"Asakusa","from_point":"HND","to_point":"Asakusa area hotels","max_passengers":4,"service_from":"05:00","service_until":"24:00","duration_minutes":40,"pricing":"PER_VEHICLE","price":{"amount":5040,"currency":"INR"}}
```

## `trip_format_example.json`

Format: json · Size: 1.0 KB · Rows: 2 · Columns: 14

- Note: Records are the elements of the array `items`.
- Every row has a different value in: `item_id`, `type`, `name`, `city`, `catalog_id`, `quantity`, `price_inr` (candidates for a natural key)

| column | type | null % | distinct | min | max | top values |
| --- | --- | --- | --- | --- | --- | --- |
| `item_id` | string | 0% | 2 |  |  |  |
| `type` | string | 0% | 2 |  |  |  |
| `name` | string | 0% | 2 |  |  |  |
| `city` | string | 0% | 2 |  |  |  |
| `status` | string | 0% | 1 |  |  | PLANNED (2) |
| `catalog_id` | string | 0% | 2 |  |  |  |
| `room_id` | string | 50% | 1 |  |  |  |
| `start` | date | 0% | 2 | 2027-04-09T23:50 | 2027-04-11 |  |
| `end` | date | 0% | 2 | 2027-04-10T10:30 | 2027-04-16 |  |
| `quantity` | integer | 0% | 2 | 1 | 3 |  |
| `price_inr` | integer | 0% | 2 | 40600 | 75600 |  |
| `booking` | empty | 100% | 0 |  |  |  |
| `sources` | array | 0% | 1 |  |  | [] (2) |
| `warnings` | array | 0% | 1 |  |  | [] (2) |

Sample rows (first 2):

```json
{"item_id":"i1","type":"flight","name":"AV 520 BLR to NRT","city":"Tokyo","status":"PLANNED","catalog_id":"FL-401","room_id":null,"start":"2027-04-09T23:50","end":"2027-04-10T10:30","quantity":3,"price_inr":75600,"booking":null,"sources":[],"warnings":[]}
{"item_id":"i2","type":"hotel","name":"Sakura Garden Hotel","city":"Kyoto","status":"PLANNED","catalog_id":"HTL-KYO-004","room_id":"RM-KYO-004-B","start":"2027-04-11","end":"2027-04-16","quantity":1,"price_inr":40600,"booking":null,"sources":[],"warnings":[]}
```

