---
"@apollo/client": patch
---

Fix `canonicalStringify` dropping an own `__proto__` key, which made its output depend on the order the keys were written in. `canonicalStringify(JSON.parse('{"b":2,"__proto__":{"x":1}}'))` returned `{"b":2}` while the same object with the keys the other way round returned both. Since `getStoreKeyName` builds cache field keys from this output, two calls carrying equal arguments could land on different store keys.
