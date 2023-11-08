---
"@apollo/client": minor
---

To work around issues in React Server Components, especially with bundling for
the Next.js "edge" runtime we now use an external package to wrap `react` imports
instead of importing React directly.
