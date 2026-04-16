# Change Log Update Guide (For AI Agents)

Use this guide whenever you update the Change Log tab in this website.

## Source of Truth

- The Change Log tab is rendered from `CHANGELOG_ENTRIES` in `app.js`.
- Do not hardcode entries in `index.html`.

## Required Entry Format

Each entry in `CHANGELOG_ENTRIES` must be an object with this shape:

```js
{
  date: "YYYY-MM-DD",
  version: "vX.Y.Z",
  title: "Short release title",
  summary: "One sentence describing why the change matters.",
  points: [
    "Bullet 1",
    "Bullet 2",
    "Bullet 3"
  ]
}
```

## Ordering Rules

1. Add new entries at the top of the array (newest first).
2. Keep date format strictly `YYYY-MM-DD`.
3. Keep `summary` to one sentence.
4. Keep exactly 3-5 bullet points in `points`.

## Content Rules

- Focus on user-visible behavior changes first.
- Mention fixes with clear scope (what was broken, what was restored).
- Avoid internal-only notes unless they affect users or maintainers.
- Keep wording concise and factual.

## When You Modify Change Log Behavior

- If UI markup/classes change, update `style.css` and `index.html` accordingly.
- Ensure `renderChangeLog()` in `app.js` still handles all fields above.
