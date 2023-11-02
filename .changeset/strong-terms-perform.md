---
"@apollo/client": minor
---

Add multipart subscription network adapters for Relay and urql

### Relay

```tsx
import { createFetchMultipartSubscription } from "@apollo/client/utilities/subscriptions/relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

const fetchMultipartSubs = createFetchMultipartSubscription(
  "http://localhost:4000"
);

const network = Network.create(fetchQuery, fetchMultipartSubs);

export const RelayEnvironment = new Environment({
  network,
  store: new Store(new RecordSource()),
});
```

### Urql

```tsx
import { createFetchMultipartSubscription } from "@apollo/client/utilities/subscriptions/urql";
import { Client, fetchExchange, subscriptionExchange } from "@urql/core";

const url = "http://localhost:4000";

const multipartSubscriptionForwarder = createFetchMultipartSubscription(
  url
);

const client = new Client({
  url,
  exchanges: [
    fetchExchange,
    subscriptionExchange({
      forwardSubscription: multipartSubscriptionForwarder,
    }),
  ],
});
```
