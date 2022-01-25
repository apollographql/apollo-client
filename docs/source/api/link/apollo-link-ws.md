---
title: WebSocket Link
sidebar_title: WebSocket (newer protocol)
description: Execute subscriptions (or other GraphQL operations) over WebSocket with the `subscriptions-transport-ws` library
api_reference: true
---

> We recommend reading [Apollo Link overview](./introduction/) before learning about individual links.

The `WebSocketLink` is a [terminating link](./introduction/#the-terminating-link) that's used most commonly with GraphQL [subscriptions](../../data/subscriptions/) (which usually communicate over WebSocket), although you can send queries and mutations over WebSocket as well.

`WebSocketLink` requires the [`subscriptions-transport-ws`](https://github.com/apollographql/subscriptions-transport-ws) library. Install it in your project like so:

```shell
npm install subscriptions-transport-ws
```

> **Note**: The `subscriptions-transport-ws` library is not actively maintained. We recommend the use of the `graphql-ws` library instead. These libraries layer different protocols on top of WebSockets, so you do need to ensure you are using the same library in your server and any clients that you support. To use `graphql-ws` from Apollo Client, use the [`GraphQLWsLink` link from `@apollo/client/link/subscriptions](./apollo-link-subscriptions) instead.

## Constructor

```js
import { WebSocketLink } from "@apollo/client/link/ws";

const link = new WebSocketLink({
  uri: "ws://localhost:3000/subscriptions",
  options: {
    reconnect: true,
  },
});
```

### Options

The `WebSocketLink` constructor takes an options object with the following fields:

<table class="field-table">
  <thead>
    <tr>
      <th>Name /<br/>Type</th>
      <th>Description</th>
    </tr>
  </thead>

<tbody>
<tr class="required">
<td>

###### `uri`

`String`
</td>
<td>

**Required.** The URL of the WebSocket endpoint to connect to (e.g., `ws://localhost:4000/subscriptions`).

</td>
</tr>

<tr>
<td>

###### `options`

`Object`
</td>
<td>

Options for configuring the WebSocket connection.

[See supported options](https://github.com/apollographql/subscriptions-transport-ws/blob/master/src/client.ts#L61-L71)

</td>
</tr>

<tr>
<td>

###### `webSocketImpl`

`Object`
</td>
<td>

A W3C-compliant WebSocket implementation to use. Provide this if your environment does not provide native WebSocket support (for example, in Node.js).

</td>
</tr>
</tbody>
</table>

## Usage

See [Subscriptions](../../data/subscriptions/).
