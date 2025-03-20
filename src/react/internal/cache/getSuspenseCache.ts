import type { ApolloClient } from "@apollo/client/core";
import type { SuspenseCacheOptions } from "@apollo/client/react/internal";

import { SuspenseCache } from "./SuspenseCache.js";

declare module "@apollo/client/core" {
  interface DefaultOptions {
    react?: {
      suspense?: Readonly<SuspenseCacheOptions>;
    };
  }
}

const suspenseCacheSymbol = Symbol.for("apollo.suspenseCache");

export function getSuspenseCache(
  client: ApolloClient & {
    [suspenseCacheSymbol]?: SuspenseCache;
  }
) {
  if (!client[suspenseCacheSymbol]) {
    client[suspenseCacheSymbol] = new SuspenseCache(
      client.defaultOptions.react?.suspense
    );
  }

  return client[suspenseCacheSymbol];
}
