---
title: WebSocket Link
sidebar_title: WebSocket
description: Send GraphQL operations over a WebSocket. Works with GraphQL Subscriptions.
---

## Overview

This link is particularly useful to use with GraphQL Subscriptions, but it will also allow you to send GraphQL queries and mutations over WebSockets.

```js
import { WebSocketLink } from "@apollo/client/link/ws";
import { SubscriptionClient } from "subscriptions-transport-ws";

const GRAPHQL_ENDPOINT = "ws://localhost:3000/graphql";

const client = new SubscriptionClient(GRAPHQL_ENDPOINT, {
  reconnect: true
});

const link = new WebSocketLink(client);
```

## Options

`@apollo/client/link/ws` takes either a subscription client, or an object with three options, to customize the behavior of the link.

| Option | Description |
| - | - |
| `uri` | A string endpoint to connect to |
| `options` | A set of options to pass to a new Subscription Client |
| `webSocketImpl` | A custom WebSocket implementation |

By default, this link uses the [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) library for the transport.
