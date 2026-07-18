---
"@apollo/client": patch
---

Cache diffs for incomplete queries no longer pay the cost of building full `MissingFieldError` diagnostics on the hot path. The internal completness check now uses a lightweight flag instead of constructing an error (which extends `Error` and always triggers a V8 stack capture), and the per-field message strings skip the `JSON.stringify` on the parent store object unless something actually reads `diff.missing`.

The real-world impact shows up most on pages with many watched queries loading at once — each arriving response dirties sibling watches, and before this change every one of those re-diffs rebuilt diagnostics only to have `diff.complete` checked and the rest thrown away. A profile from the original issue measured ~95–140ms of main-thread time wasted on that work in a single page load, with over 90ms in the `MissingFieldError` constructor alone.
