## Using this codemod

You can run this codemod with the following command:

```bash
npx @apollo/client-codemod-migrate-3-to-4 --parser ts file1.ts file2.ts
```

if you want to only run a specific codemod:

```bash
npx @apollo/client-codemod-migrate-3-to-4 --parser ts file1.ts file2.ts  --codemod imports
```

Or from a PR:

```sh
npx https://pkg.pr.new/apollographql/apollo-client/@apollo/client-codemod-migrate-3-to-4@12733 --parser ts file1.ts file2.ts
```
