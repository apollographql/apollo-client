---
"@apollo/client": patch
---

Add the ability to override the default event handler on `RefetchEventManager`. The default handler runs when no per-source handler is configured for an event. Provide a custom handler via the `defaultHandler` constructor option or the `setDefaultEventHandler` instance method.

```ts
new RefetchEventManager({
  defaultHandler: ({ client, matchesRefetchOn }) => {
    return client.refetchQueries({
      include: "all",
      onQueryUpdated: matchesRefetchOn,
    });
  },
});
```
