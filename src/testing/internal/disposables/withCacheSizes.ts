import type { CacheSizes } from "@apollo/client/utilities";
import { cacheSizes } from "@apollo/client/utilities";

import { withCleanup } from "./withCleanup.js";

export function withCacheSizes(tempCacheSizes: Partial<CacheSizes>) {
  const prev = { prevCacheSizes: { ...cacheSizes } };
  Object.entries(tempCacheSizes).forEach(([key, value]) => {
    cacheSizes[key as keyof CacheSizes] = value;
  });

  return withCleanup(prev, ({ prevCacheSizes }) => {
    Object.keys(tempCacheSizes).forEach((k) => {
      const key = k as keyof CacheSizes;
      if (key in prevCacheSizes) {
        cacheSizes[key as keyof CacheSizes] =
          prevCacheSizes[key as keyof CacheSizes];
      } else {
        delete cacheSizes[key];
      }
    });
  });
}
