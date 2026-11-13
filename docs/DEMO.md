# Demo plan

Fill this in on the day. Every task must serve a numbered step below (see AGENTS.md).

**Customer:**

**Their pain:**

## Happy path

1.
2.
3.

## The one edge case we will show

## Cut list

Not building, so nobody starts on it:

-

## Pitch

The agent making the deck reads `docs/PROBLEM.md`, `docs/SOLUTION.md`, this file and `../decisions/` (outside the repo).

**Time limit:**

**Audience:**

### Slide order

1.
2.
3.

### What we must say out loud

Assumptions and trade-offs a judge should hear from us first:

- **The multi-city search is exact and cheap (v2).** For Menon, trying every combination across the 27 city plans is
  6,990,380 packages: every hotel in each city × every flight and airport transfer at each end. No city's choices
  change another city's, so we price each city on its own and add up: 1,401 room options + 3,296 flight-and-transfer
  checks, about 4,700 small checks, roughly 1,500 times less work for the same answer. One city alone (v1) is 69 room
  options + 344 checks. Like a thali: when dal, rice and sabzi are priced separately, the cheapest thali is the
  cheapest of each. _Measured with a prototype on 13 Nov; measure again on the builder once v2 ships._
- **The arrival afternoon is free on purpose.** The package plans no visit on the arrival day (optional under §4, and
  the family has just flown overnight). The day's card shows what still fits instead: Menon is at the hotel by 13:00
  and 9 attractions still fit, 2 of them free.
