---
title: GraphQL server guide
order: 202
description: These are Apollo Docs!!
---

This guide will walk you through building a GraphQL server using graphql-tools, a package we are actively developing for [Apollo](http://www.apollostack.com). There are of course many ways to build a GraphQL server for Node.js, but this is the way we recommend. It describes each step in detail, from defining a schema to writing your own resolve functions and loaders.

## Setup
For this guide, we'll assume that you are familiar with using the command line of your operating system and already have Node 5 and npm set up for your environment.
If that's not the case, you should [do that first](https://nodejs.org/en/download/package-manager/) before you read the rest of this guide.

To get started, you need to install a few packages and set up some boilerplate. To make this easier, we've created a barebones started kit which you can use:
```bash
git clone --branch server-only https://github.com/apollostack/apollo-starter-kit
cd apollo-starter-kit
npm install
```

This will download the starter-kit from GitHub and install all the npm packages you need to get started.

Once the installation is finished, you can launch the server with this command:
```bash
npm start
```
If all goes well, the server should now print out a message that it is listening on port 8080. If you open [localhost:8080](http://localhost:8080/?query=%7B%0A%20%20testString%0A%7D) in your browser, you should now see the GraphiQL GUI for GraphQL, ready to query the server:

![Testing the server with GraphiQL](graphiql-test.png)

**For advanced users:**
If you already have an express server or a GraphQL server set up, then you can also simply install graphql-tools with the command `npm install graphql-tools` and jump to the [Tools](tools.html) section in this guide to learn about using the individual parts of the graphql-tools package.


## Schema

## Mocking

## Resolve Functions

## Connectors

### SQL

### MongoDB

### REST / HTTP
