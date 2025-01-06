---
"@apollo/client": patch
---

By default, do not change TypeScript types unless opting in or out of data masking. Introduces support for `enabled: false` with the `DataMasking` type which will then unmask types. This change should prevent cases where types unexpectedly change as the default behavior when upgrading from older versions of the client and provides better compilation performance when you don't need unmasked types.
