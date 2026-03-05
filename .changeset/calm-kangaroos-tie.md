---
"@apollo/client": patch
---

Fix issue where muting a deprecation from one entrypoint would not mute the warning when checked in a different entrypoint. This caused some rogue deprecation warnings to appear in the console even though the warnings should have been muted.
