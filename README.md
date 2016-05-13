# Apollo client

[![npm version](https://badge.fury.io/js/apollo-client.svg)](https://badge.fury.io/js/apollo-client)
[![Get on Slack](http://slack.apollostack.com/badge.svg)](http://slack.apollostack.com/)

The Apollo Client can easily be dropped into any JavaScript frontend where you want to use data from a GraphQL server.

## Installing

```txt
npm install apollo-client
```

To use this client in a web browser or mobile app, you'll need a build system capable of loading NPM packages on the client. Some common choices include Browserify, Webpack, and Meteor 1.3. Move on to the next article to see how to import and initialize the client.

[Read the docs.](http://docs.apollostack.com/apollo-client/index.html)

---

## Contributing

[![Build status](https://travis-ci.org/apollostack/apollo-client.svg?branch=master)](https://travis-ci.org/apollostack/apollo-client)
[![Build status](https://ci.appveyor.com/api/projects/status/ajdf70delshw2ire/branch/master?svg=true)](https://ci.appveyor.com/project/stubailo/apollo-client/branch/master)
[![Coverage Status](https://coveralls.io/repos/github/apollostack/apollo-client/badge.svg?branch=master)](https://coveralls.io/github/apollostack/apollo-client?branch=master)

Running tests locally:

```
# nvm use node
npm install
npm test
```

This project uses TypeScript for static typing and TSLint for linting. You can get both of these built into your editor with no configuration by opening this project in [Visual Studio Code](https://code.visualstudio.com/), an open source IDE which is available for free on all platforms.

#### Useful tools

Should be moved into some kind of CONTRIBUTING.md soon...

- [AST explorer](https://astexplorer.net/): you can use this to see what the GraphQL query AST looks like for different queries

#### Important discussions

If you're getting booted up as a contributor, here are some discussions you should take a look at:

1. [Static typing and why we went with TypeScript](https://github.com/apollostack/apollo-client/issues/6) also covered in [the Medium post](https://medium.com/apollo-stack/javascript-code-quality-with-free-tools-9a6d80e29f2d#.k32z401au)
1. [Idea for pagination handling](https://github.com/apollostack/apollo-client/issues/26)
1. [Discussion about interaction with Redux and domain vs. client state](https://github.com/apollostack/apollo-client/issues/98)
1. [Long conversation about different client options, before this repo existed](https://github.com/apollostack/apollo/issues/1)
