---
"@apollo/client": minor
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

Apollo Client now ships with a `CombineLinkContextOptions` type that allows you to add types for links used in your link chain. Any links that provide context options can be used with this type to provide those links types to context. For example, to add context options from `HttpLink`, add the following code:

```ts
import { CombineLinkContextOptions, HttpLink } from "@apollo/client";

declare module "@apollo/client" {
  interface DefaultContext extends
    CombineLinkContextOptions<[HttpLink.ContextOptions]> {
    myProperty: string;
  }
}
```

At this time, the following built-in links support context options:
- `HttpLink.ContextOptions`
- `BatchHttpLink.ContextOptions`
