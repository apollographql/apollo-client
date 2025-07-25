import * as prettier from "prettier";
const code = `
Notice that the \`Trail\` component isn't receiving the entire \`trail\` object via props, only the \`id\` which is used along with the fragment document to create a live binding for each trail item in the cache. This allows each \`Trail\` component to react to the cache updates for a single trail independently. Updates to a trail's \`status\` will not cause the parent \`App\` component to rerender since the \`@nonreactive\` directive is applied to the \`TrailFragment\` spread, a fragment that includes the \`status\` field.

<MinVersion version="3.12.0">
## \`@unmask\`
</MinVersion>

The \`@unmask\` directive is used to make fragment data available when using [data masking](./fragments#data-masking). It is primarily used to [incrementally adopt data masking in an existing application](./fragments#incremental-adoption-in-an-existing-application). It is considered an escape hatch for all other cases where working with masked data would otherwise be difficult.

\`\`\`graphql
query GetPosts {
  posts {
    id
    ...PostDetails @unmask
  }
}
\`\`\`

`;

const result = await prettier.format(code, {
  parser: "mdx3",
  plugins: ["./format-mdx3.js"],
});

console.log(result);
