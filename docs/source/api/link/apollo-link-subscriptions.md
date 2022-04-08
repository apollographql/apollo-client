---
title: Subscriptions Link
description: Execute subscriptions (or other operations) over WebSocket with the graphql-ws library
api_reference: true
---

> We recommend reading [Apollo Link overview](./introduction/) before learning about individual links.

The `GraphQLWsLink` is a [terminating link](./introduction/#the-terminating-link) that's used most commonly with GraphQL [subscriptions](../../data/subscriptions/) (which usually communicate over WebSocket), although you can send queries and mutations over WebSocket as well.

`GraphQLWsLink` requires the [`graphql-ws`](https://www.npmjs.com/package/graphql-ws) library. Install it in your project like so:

```shell
npm install graphql-ws
```

> **Note**: This link works with the newer `graphql-ws` library. If your server uses the older `subscriptions-transport-ws`, you should use the [`WebSocketLink` link from `@apollo/client/link/ws`](./apollo-link-ws) instead.

## Constructor

```js
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

const link = new GraphQLWsLink(
  createClient({
    url: "ws://localhost:3000/subscriptions",
  }),
);
```

### Options

The `GraphQLWsLink` constructor takes a single argument, which is a `Client` returned from the `graphql-ws` `createClient` function.

The `createClient` function can take many options, described in the [`graphql-ws` docs for `ClientOptions`](https://github.com/enisdenjo/graphql-ws/blob/master/docs/interfaces/client.ClientOptions.md). The one required option is `url`, which is the URL (typically starting with `ws://` or `wss://`, which are the equivalents of `http://` and `https://` respectively) to your WebSocket server. (Note that this differs from the [older link's URL option](./apollo-link-ws), which is named `uri` instead of `url`.)

## Usage

See [Subscriptions](../../data/subscriptions/).
