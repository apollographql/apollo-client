---
"@apollo/client": patch
---

Fix a potential memory leak where Trie nodes would remain in memory too long.
