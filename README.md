# Apollo client

[![npm version](https://badge.fury.io/js/apollo-client.svg)](https://badge.fury.io/js/apollo-client)
[![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](http://www.apollostack.com/#slack)

Apollo Client can be used in any JavaScript frontend where you want to use data from a GraphQL server. It's:

1. **Incrementally adoptable**, so that you can drop it into an existing JavaScript app and start using GraphQL for just part of your UI.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
2. **Simple to get started with**, you can start loading data right away and learn about advanced features later.
3. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
4. **Built for interactive apps**, so your users can make changes and see them reflected in the UI immediately.
4. **Small and flexible**, so you don't get stuff you don't need. The core is under 25kb compressed.
5. **Community driven**, Apollo is driven by the community and serves a variety of use cases. Everything is planned and developed in the open.

Get started on the [home page](http://dev.apollodata.com/), which has great examples for a variety of frameworks.

## Installation

```txt
npm install apollo-client
```

To use this client in a web browser or mobile app, you'll need a build system capable of loading NPM packages on the client. Some common choices include Browserify, Webpack, and Meteor 1.3.

**NEW:** Install the [Apollo Client Developer tools for Chrome](https://chrome.google.com/webstore/detail/apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm) for a great GraphQL developer experience!

## Learn how to use Apollo Client with your favorite framework

- [React](http://dev.apollodata.com/react/)
- [Angular 2](http://dev.apollodata.com/angular2/)
- [Vue](https://github.com/Akryum/vue-apollo)
- [Ember](https://github.com/bgentry/ember-apollo-client)
- [Polymer](https://github.com/aruntk/polymer-apollo)
- [Meteor](http://dev.apollodata.com/core/meteor.html)
- [Vanilla JS](http://dev.apollodata.com/core/)

---

## Contributing

[![Build status](https://travis-ci.org/apollostack/apollo-client.svg?branch=master)](https://travis-ci.org/apollostack/apollo-client)
[![Build status](https://ci.appveyor.com/api/projects/status/ajdf70delshw2ire/branch/master?svg=true)](https://ci.appveyor.com/project/stubailo/apollo-client/branch/master)
[![Coverage Status](https://coveralls.io/repos/github/apollostack/apollo-client/badge.svg?branch=master)](https://coveralls.io/github/apollostack/apollo-client?branch=master)

[Read the Apollo Contributor Guidelines.](CONTRIBUTING.md)

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
