---
"@apollo/client": major
---

Switch to [RxJS](https://rxjs.dev/) as the observable implementation. `rxjs` is now a peer dependency of Apollo Client which means you will now need to install `rxjs` in addition to `@apollo/client`.

This change is mostly transparent, however transforming values on observables, common in link implementations, differs in RxJS vs `zen-observable`. For example, you could modify values in the link chain emitted from a downstream link by using the `.map` function. In RxJS, this is done with the `.pipe` function and passing a `map` operator instead.

```ts
import { map } from "rxjs";

const link new ApolloLink((operation, forward) => {
  return forward(operation).pipe(
    map((result) => performTransform(result))
  );
});
```

For a full list of operators and comprehensive documentation on the capabilities of RxJS, check out the [documentation](https://rxjs.dev/).
