## Using this codemod

You can run this codemod with the following command:

```bash
npx @apollo/client-codemod-migrate-3-to-4 --parser ts file1.ts file2.ts
```

if you want to only run a specific codemod:

```bash
npx @apollo/client-codemod-migrate-3-to-4 --parser ts file1.ts file2.ts  --codemod imports
```

### Usage against TypeScript/TSX

There is some syntax overlap between TypeScript and TypeScript-JSX files, so you might need to run the Codemod against both file extensions sepearately to avoid errors:

```sh
npx @apollo/client-codemod-migrate-3-to-4 --parser ts --ignore-pattern="*.{tsx,d.ts}" file1.ts file2.ts
npx @apollo/client-codemod-migrate-3-to-4 --parser tsx --ignore-pattern="*.ts" file1.ts file2.ts
```

### Using the Codemod from a specific PR

```sh
npx https://pkg.pr.new/apollographql/apollo-client/@apollo/client-codemod-migrate-3-to-4@12733 --parser ts file1.ts file2.ts
```
