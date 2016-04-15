---
title: GraphQL server guide
order: 202
description: These are Apollo Docs!!
---

This guide will walk you through building a GraphQL server using graphql-tools, a package we are actively developing for the Apollo stack. There are of course many ways to build a GraphQL server for Node.js, but this is the way we recommend. It describes each step in detail, from defining a schema to writing your own resolve functions and loaders.

## Setup
For this guide, we'll assume that you are familiar with using the command line of your OS and already have Node 5 and npm set up for your environment.
If that's not the case, you should [do that first](https://nodejs.org/en/download/package-manager/) before you read the rest of this guide.
Furthermore, we'll also assume that you already have Babel 6 installed, because the JavaScript syntax we're using in this tutorial uses Babel to transpile it for Node 5. If you don't have Babel set up, follow the [instructions for setting up Babel](https://babeljs.io/blog/2015/10/31/setting-up-babel-6).

To get started, create a new folder for your project and run `npm init`, which will ask you a few questions about your project. If you don't care about sharing your code with anyone, you can just skip over them by pressing `Enter` repeatedly:
```bash
mkdir myServer
cd myServer
npm init
```

Next, you'll need to install a preset and tell Babel to use it. A preset defines what things Babel should transpile and polyfill. Here, we'll use the Meteor preset, which includes arrow functions, object descructuring etc.
```bash
npm i --save babel-preset-meteor
echo "{presets:[\"meteor\"]}" > .babelrc
```

Finally, we're ready to install the actual packages that we'll be using in this project.

## Schema

## Mocking

## Resolve Functions

## Connectors

### SQL

### MongoDB

### REST / HTTP
