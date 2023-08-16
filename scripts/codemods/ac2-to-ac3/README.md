# Migrating `import`s from Apollo Client 2.x to 3.x

This directory contains a [jscodeshift](https://www.npmjs.com/package/jscodeshift)-based
transform for translating `import` declarations and package names from
Apollo Client 2.x to Apollo Client 3.x, following the [migration guide](https://www.apollographql.com/docs/react/migrating/apollo-client-3-migration/).

While this transform should simplify the migration process by removing
some manual effort, you should nevertheless check the results carefully,
and use version control to recover your original code if anything goes
wrong. We welcome issues and pull requests to improve this transform.

## Running the transform

To run the transform over a directory of source files, first install
`jscodeshift` using `npm i --save-dev jscodeshift`, then choose among the
following commands to run, depending on the types of files you have:

```sh
# To transform all .js files:
npx jscodeshift \
  -t apollo-client/scripts/codemods/ac2-to-ac3/imports.js \
  --extensions js \
  source-directory

# To transform all .ts files:
npx jscodeshift \
  -t apollo-client/scripts/codemods/ac2-to-ac3/imports.js \
  --extensions ts --parser ts \
  source-directory

# To transform all .tsx files:
npx jscodeshift \
  -t apollo-client/scripts/codemods/ac2-to-ac3/imports.js \
  --extensions tsx --parser tsx \
  source-directory
```

Note that the `apollo-client` directory here is intended to be a checkout
of [this repository](https://github.com/apollographql/apollo-client/).

## Kicking the tires

To see how the transform handles some example source files, run the
following commands in this directory (within a checkout of the Apollo
Client repository):

```sh
npm install
npx jscodeshift -t imports.js --extensions js examples
npx jscodeshift -t imports.js --extensions ts --parser ts examples
npx jscodeshift -t imports.js --extensions tsx --parser tsx examples
```

Running `git diff` after these commands will display the changes made by
the transform.

## Known limitations

This transform does not currently handle

* `export ... from "apollo-*"` declarations
* `import * as namespace from "apollo-*"` declarations
* Imports from the older `react-apollo` package
* Checking for proper usage of moved imports

If you discover other shortcomings, please feel free to suggest additions
to this list, or submit a PR that adds additional examples demonstrating
the problem, or try your hand at improving the transform.
