import type { SuspenseCacheOptions } from "@apollo/client/react/internal";
import { SuspenseCache } from "./SuspenseCache.js";
import type { ApolloClient } from "@apollo/client/core";

declare module "@apollo/client/core" {
  interface DefaultOptions {
    react?: {
      suspense?: Readonly<SuspenseCacheOptions>;
    };
  }
}

const suspenseCacheSymbol = Symbol.for("apollo.suspenseCache");

export function getSuspenseCache(
  client: ApolloClient<object> & {
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
