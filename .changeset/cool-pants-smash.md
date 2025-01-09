---
"@apollo/client": patch
---

Changes the default behavior of the `MaybeMasked` type to preserve types unless otherwise specified. This change makes it easier to upgrade from older versions of the client where types could have unexpectedly changed in the application due to the default of trying to unwrap types into unmasked types. This change also fixes the compilation performance regression experienced when simply upgrading the client since types are now preserved by default.

A new `mode` option has now been introduced to allow for the old behavior. See the next section on migrating if you wish to maintain the old default behavior after upgrading to this version.

### Migrating from 3.12.4 or below

If you've adopted data masking and have opted in to using masked types by setting the `enabled` property to `true`, you can remove this configuration entirely:

```diff
-declare module "@apollo/client" {
-  interface DataMasking {
-    mode: "unmask"
-  }
-}
```

If you prefer to specify the behavior explicitly, change the property from `enabled: true`, to `mode: "preserveTypes"`:

```diff
declare module "@apollo/client" {
  interface DataMasking {
-    enabled: true
+    mode: "preserveTypes"
  }
}
```

If you rely on the default behavior in 3.12.4 or below and would like to continue to use unmasked types by default, set the `mode` to `unmask`:

```ts
declare module "@apollo/client" {
  interface DataMasking {
    mode: "unmask"
  }
}
```
