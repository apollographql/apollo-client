---
"@apollo/client": minor
---

Add a codemod that renames old import locations from 3.x entrypoint to their 4.x entrypoint.

To run the codemod:

1. Clone the [`apollo-client` repository](https://github.com/apollographql/apollo-client)

   ```sh
   git clone https://github.com/apollographql/apollo-client.git
   ```

2. Install dependencies in `apollo-client`

    ```sh
    npm install
    ```

3. Run the codemod via [`jscodeshift`](https://github.com/facebook/jscodeshift) against your codebase.

   ```sh
   npx jscodeshift -t ../path/to/apollo-client/scripts/codemods/ac3-to-ac4/imports.ts --extensions tsx --parser tsx ./src/**/*.tsx
   ```

The codemod supports `.js`, `.jsx`, `.ts`, and `.tsx` files.
