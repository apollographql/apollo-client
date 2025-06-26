---
"@apollo/client-codemod-migrate-3-to-4": major
---

Add a codemod that renames old import locations from 3.x entrypoint to their 4.x entrypoint.

Run the codemod using the following command:

```sh
npx @apollo/client-codemod-migrate-3-to-4 --parser tsx ./src/**/*.{ts,tsx}
```

The codemod supports `.js`, `.jsx`, `.ts`, and `.tsx` files.
