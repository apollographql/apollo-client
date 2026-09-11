import type { CombinedGraphQLErrors } from "@apollo/client/errors";

import type { DataState } from "./types.js";

// When working with an incremental result, errors in `@defer` fragments might
// bubble to the fragment boundary which leaves a hole in the data. When the
// `errorPolicy` is `"none"` we `throw` the constructed error so that it moves
// through the observable error flow. Because of this, we need a way to
// communicate the known dataState returned by QueryInfo to ObservableQuery.
// This ensures a "streaming" dataState can still be reported for errorPolicy:
// "none" queries.
export const dataStateErrorCache = new WeakMap<
  CombinedGraphQLErrors,
  DataState<any>["dataState"]
>();
