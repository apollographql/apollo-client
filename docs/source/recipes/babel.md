---
title: Precompilation with babel
---

If you prefer co-locating your GraphQL queries in your Javascript files, you typically use the [graphql-tag](https://github.com/apollographql/graphql-tag) library to write them. That requires to process the query strings into a GraphQL AST, which will add to the startup time of your application, especially if you have many queries.

To avoid this runtime overhead, you can precompile your queries created with `graphql-tag` using [Babel](http://babeljs.io/). Here are two ways you can do this:

1. Using [babel-plugin-graphql-tag](#using-babel-plugin-graphql-tag)
2. Using [graphql-tag.macro](#using-graphql-tagmacro)

## Using babel-plugin-graphql-tag

This approach will allow you to use the `graphql-tag` library as usual, and when processing the files with this babel plugin, the calls to that library will be replaced by the precompiled result.

Install the plugin in your dev dependencies:

```
# with npm
npm install --save-dev babel-plugin-graphql-tag

# or with yarn
yarn add --dev babel-plugin-graphql-tag
```

Then add the plugin in your `.babelrc` configuration file:

```
{
  "plugins": [
    "graphql-tag"
  ]
}
```

And that's it! All the usages of `import gql from 'graphql-tag'` will be removed, and the calls to `gql` will be replaced by the compiled version.

## Using graphql-tag.macro

This approach is a bit more explicit, since you change all your usages of `graphql-tag` for `graphql-tag.macro`, which exports a `gql` function that you can use the same way as the original one. This macro requires the [babel-macros](https://github.com/kentcdodds/babel-macros) plugin, which will do the same as the previous approach but only on the calls that come from the macro import, leaving regular calls to the `graphql-tag` library untouched.

Why would you prefer this approach? Mainly because it requires less configuration (`babel-macros` works with all kinds of macros, so if you already had it installed you don't have to do anything else), and also because of the explicitness. You can read more about the rationale of using `babel-macros` [in this blog post](http://babeljs.io/blog/2017/09/11/zero-config-with-babel-macros).

To use it, provided that you [already have babel-macros installed](https://github.com/kentcdodds/babel-macros#installation) and [configured](https://github.com/kentcdodds/babel-macros/blob/master/other/docs/user.md), you just need to change this:

```js
import gql from 'graphql-tag';

const query = gql`
  query {
    hello {
      world
    }
  }
`;
```

to this:

```js
import gql from 'graphql-tag.macro'; // <-- Use the macro

const query = gql`
  query {
    hello {
      world
    }
  }
`;
```

## Fragments

Both approaches work with fragments. You can have fragments defined in a different call to `gql` (either in the same file or in a different one). You can then include them into the main query using interpolation, like this:

```js
import gql from 'graphql-tag';
// or import gql from 'graphql-tag.macro';

const fragments = {
  hello: gql`
    fragment HelloStuff on Hello {
      universe
      galaxy
    }
  `
};

const query = gql`
  query {
    hello {
      world
      ...HelloStuff
    }
  }

  ${fragments.hello}
`;
```
