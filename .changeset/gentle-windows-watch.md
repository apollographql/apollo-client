---
"@apollo/client": minor
---

Add support for automatic event-based refetching, such as window focus.

The `RefetchEventManager` class handles automatic refetches in response to events. Apollo Client provides built-in sources for window focus and network reconnect as `windowFocusSource` and `onlineSource`.

Event refetching is fully opt-in. Create and pass a `RefetchEventManager` instance to the `ApolloClient` constructor to activate the event listeners.

```ts
import {
  ApolloClient,
  InMemoryCache,
  RefetchEventManager,
  windowFocusSource,
  onlineSource,
} from "@apollo/client";

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
  refetchEventManager: new RefetchEventManager({
    sources: {
      // Refetch when window is focused
      windowFocus: windowFocusSource,

      // Refetch when the user comes back online
      online: onlineSource,
    },
  }),
});
```

By default, all active queries refetch when the events fire. Queries can opt out per-event or disable all event refetches:

```ts
// Skip refetch on window focus for this query, but keep `online`
useQuery(QUERY, {
  refetchOn: { windowFocus: false },
});

// Disable all event-driven refetches for this query
useQuery(OTHER_QUERY, {
  refetchOn: false,
});

// Enable every event for this query, regardless of defaultOptions
useQuery(LIVE_DASHBOARD, {
  refetchOn: true,
});
```

To enable per-query opt-in rather than opt-out, set `defaultOptions.watchQuery.refetchOn` to `false` and enable it per-query instead.

```ts
const client = new ApolloClient({
  link,
  cache,
  refetchEventManager: new RefetchEventManager({
    sources: { windowFocus: windowFocusSource },
  }),
  defaultOptions: {
    watchQuery: { refetchOn: false },
  },
});

// Only this query refetches on window focus
useQuery(DASHBOARD_QUERY, { refetchOn: { windowFocus: true } });
```

When `defaultOptions.watchQuery.refetchOn` and per-query `refetchOn` options are provided, the objects are merged together.

### Custom events

You can also add your own custom events that trigger refetches. Register your event name and payload type using TypeScript module augmentation, then provide a source function that returns an Observable. The source's emitted value becomes the event's `payload`.

```ts
import { Observable } from "@apollo/client";
import { filter } from "rxjs";
import { AppState, AppStateStatus, Platform } from "react-native";

declare module "@apollo/client" {
  interface RefetchEvents {
    reactNativeAppStatus: AppStateStatus;
  }
}

const refetchEventManager = new RefetchEventManager({
  sources: {
    reactNativeAppStatus: () => {
      return new Observable((observer) => {
        const subscription = AppState.addEventListener("change", observer.next);
        return () => subscription.remove();
      }).pipe(filter((status) => Platform.OS !== "web" && status === "active"));
    },
  },
});

// Disable per-query by setting the event to false
useQuery(QUERY, { refetchOn: { reactNativeAppStatus: false } });
```

### Manually trigger an event refetch

Refetches can be triggered imperatively by calling `emit` with the event name and its payload (if any).

```ts
refetchEventManager.emit("reactNativeAppStatus", "active");
```

#### Sourceless events

A source that has no automatic detection logic but still wants imperative `emit` support can be declared as `true`. Type the event as `void` to omit the payload argument.

```ts
declare module "@apollo/client" {
  interface RefetchEvents {
    userTriggered: void;
  }
}

const refetchEventManager = new RefetchEventManager({
  sources: { userTriggered: true },
});

refetchEventManager.emit("userTriggered");
```

Note: Calling `emit` on an event without a registered source will log a warning and result in a no-op.

### Custom handlers

When an event fires, the default handler calls `client.refetchQueries({ include: "active" })` filtered by each query's `refetchOn` setting. You can override the handler for an event to add your own custom filtering. For example, to refetch all queries, including `standby` queries, define a handler for the event:

```ts
const refetchEventManager = new RefetchEventManager({
  // ...
  handlers: {
    userTriggered: ({ client, source, payload }) => {
      return client.refetchQueries({
        include: "all",
        onQueryUpdated: (oq) => {
          const refetchOn = oq.options.refetchOn;

          return refetchOn !== false && refetchOn?.[source] !== false;
        },
      });
    },
  },
});
```

Handlers must return a `RefetchQueriesResult`. Conditionally skip a refetch for an event by returning `void`.
