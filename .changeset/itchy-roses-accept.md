---
"@apollo/client": patch
_tags:
  - other
---

Use an an empty object (`{}`) rather than an object with `null` prototype (`Object.create(null)`) in all areas that instantiate objects.
