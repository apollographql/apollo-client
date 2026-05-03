---
"@apollo/client": patch
---

Fix prototype chain manipulation vulnerability in DeepMerger

When merging server-controlled data containing a `"__proto__"` key (e.g. from `JSON.parse`), `DeepMerger` would call `target["__proto__"] = value`, which invokes the `__proto__` setter and silently replaces the target object's `[[Prototype]]`. This could allow a malicious or compromised GraphQL server to inject arbitrary properties into cached objects via prototype chain manipulation.

The fix skips `__proto__` and `constructor` keys during merging to prevent prototype chain manipulation.
