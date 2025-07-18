# @apollo/client-codemod-migrate-3-to-4

## 1.0.0-rc.1

### Patch Changes

- [#12775](https://github.com/apollographql/apollo-client/pull/12775) [`454ec78`](https://github.com/apollographql/apollo-client/commit/454ec78b751853da07243174a6f9bdc4535e7e8f) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Don't export `gql` from `@apollo/client/react` entrypoint. Import from `@apollo/client` instead.

## 1.0.0-rc.0

### Major Changes

- [#12727](https://github.com/apollographql/apollo-client/pull/12727) [`b845906`](https://github.com/apollographql/apollo-client/commit/b8459062caae96447b4867be75a853aa1943ec31) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add a codemod that renames old import locations from 3.x entrypoint to their 4.x entrypoint.

  Run the codemod using the following command:

  ```sh
  npx @apollo/client-codemod-migrate-3-to-4 --parser tsx ./src/**/*.{ts,tsx}
  ```

  The codemod supports `.js`, `.jsx`, `.ts`, and `.tsx` files.
