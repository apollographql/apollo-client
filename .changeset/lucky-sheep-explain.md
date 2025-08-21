---
"@apollo/client": minor
_tags:
  - types
  - links
---

Provide an extension to define types for `context` passed to the link chain. To define your own types, use [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) to add properties to the `DefaultContext` type.

```ts
// @apollo-client.d.ts
// This import is necessary to ensure all Apollo Client imports
// are still available to the rest of the application.
import '@apollo/client';

declare module "@apollo/client" {
  interface DefaultContext extends Record<string, any> {
    myProperty: string;
  }
}
```

Links that provide context options can be used with this type to add those context types to `DefaultContext`. For example, to add context options from `HttpLink`, add the following code:

```ts
import { HttpLink } from "@apollo/client";

declare module "@apollo/client" {
  interface DefaultContext extends HttpLink.ContextOptions {
    myProperty: string;
  }
}
```

At this time, the following built-in links support context options:
- `HttpLink.ContextOptions`
- `BatchHttpLink.ContextOptions`
