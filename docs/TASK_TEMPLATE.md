# Task template

Copy this into the prompt for a coding agent. Fill every part. A short, specific task beats a long vague one.

```
Goal:
  One sentence: what should be true when this is done.

Scope (files and areas):
  e.g. apps/api/src/modules/hotels/*, packages/shared/src/hotels.ts

Out of scope:
  What not to touch or build, even if it looks useful.

Acceptance criteria:
  - Observable checks, e.g. "GET /api/hotels?city=X returns only hotels in X"
  - npm run check passes

Demo step it serves:
  Number from docs/DEMO.md. If none, it goes in docs/IDEAS.md instead.
```

Start with: "Read AGENTS.md. Copy `modules/events` and `features/events`."
