---
"@apollo/client": patch
---

Provide a codemod that applies `@unmask` to all named fragments for all operations and fragments. To use the codemod, run the following command:

```
npx jscodeshift -t node_modules/@apollo/client/scripts/codemods/data-masking/unmask.ts --extensions tsx path/to/app/
```

To customize the tag used to search for GraphQL operations, use the `--tag` option. By default the codemod looks for `gql` and `graphql` tags.

To apply the directive in migrate mode in order to receive runtime warnings on potentially masked fields, use the `--mode migrate` option.

For more information on the options that can be used with `jscodeshift`, check out the [`jscodeshift` documentation](https://github.com/facebook/jscodeshift).
