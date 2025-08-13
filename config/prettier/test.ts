import * as prettier from "prettier";
const code = `
\`\`\`ts
const client = new ApolloClient({
  link: new HttpLink({ // [!code ++]
    uri: "https://example.com/graphql",
  }),
});
\`\`\`
`;

const result = await prettier.format(code, {
  parser: "mdx3",
  plugins: ["./format-mdx3.js"],
});

console.log(result);
