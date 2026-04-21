## Using this codemod

You can run this codemod with the following command:

```bash
npx @apollo/client-codemod-migrate-3-to-4 --parser ts file1.ts file2.ts
```

if you want to only run a specific codemod:

```bash
npx @apollo/client-codemod-migrate-3-to-4 --parser ts file1.ts file2.ts  --codemod imports
```

### Available codemods:

In the order they will be applied per default if you don't manually specify a codemod:

- `legacyEntryPoints`: Moves imports from old legacy entry points like `@apollo/client/main.cjs` or `@apollo/client/react/react.cjs` to the new entry points like `@apollo/client` or `@apollo/client/react`.
- `imports`: Moves imports that have been moved or renamed in Apollo Client 4. Also moves types into namespace imports where applicable.
- `links`: Moves `split`, `from`, `concat` and `empty` onto the `ApolloLink` namespace, changes function link invocations like `createHttpLink(...)` to their class equivalents like (`new HttpLink(...)`).
  Does not change `setContext((operation, prevContext) => {})` to `new ContextLink((prevContext, operation) => {})` - this requires manual intervention, as the order of callback arguments is flipped and this is not reliable codemoddable.
- `removals`: Points all imports of values or types that have been removed in Apollo Client 4 to the `@apollo/client/v4-migration` entry point. That entry point contains context for each removal, oftentimes with migration instructions.
- `clientSetup`: Applies the following steps from the migration guide to your Apollo Client setup code
  - Moves `uri`, `headers` and `credentials` to the `link` option and creates a new `HttpLink` instance
  - Moves `name` and `version` into a `clientAwareness` option
  - Adds a `localState` option with a new `LocalState` instance, moves `resolvers`, and removes `typeDefs` and `fragmentMatcher` options
  - Changes the `connectToDevTools` option to `devtools.enabled`
  - Renames `disableNetworkFetches` to `prioritizeCacheValues`
  - If `dataMasking` is enabled, adds a template for global type augmentation to re-enable data masking types
  - Adds the `incrementalHandler` option and adds a template for global type augmentation to accordingly type network responses in custom links
  - Removes the `TCacheShape` type argument from all `ApolloClient` usages (types and constructor calls)

### Usage against TypeScript/TSX

There is some syntax overlap between TypeScript and TypeScript-JSX files, so you might need to run the Codemod against both file extensions separately to avoid errors:

```sh
npx @apollo/client-codemod-migrate-3-to-4 --parser ts --ignore-pattern="*.{tsx,d.ts}" file1.ts file2.ts
npx @apollo/client-codemod-migrate-3-to-4 --parser tsx --ignore-pattern="*.ts" file1.ts file2.ts
```

### Using the Codemod from a specific PR

```sh
npx https://pkg.pr.new/apollographql/apollo-client/@apollo/client-codemod-migrate-3-to-4@12733 --parser ts file1.ts file2.ts
```
