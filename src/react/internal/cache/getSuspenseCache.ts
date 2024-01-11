import type { SuspenseCacheOptions } from "../index.js";
import { SuspenseCache } from "./SuspenseCache.js";
import type { ApolloClient } from "../../../core/ApolloClient.js";

declare module "../../../core/ApolloClient.js" {
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
