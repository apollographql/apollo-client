import type { ExecutionPatchResult, GraphQLRequest } from "@apollo/client/link";
import {
  DeepMerger,
  isNonEmptyArray,
  mergeIncrementalData,
} from "@apollo/client/utilities/internal";

import type { Cache } from "../core/types/Cache.js";

export class DefaultStrategy implements Cache.IncrementalStrategy {
  merge<TData>(data: TData, chunk: ExecutionPatchResult<TData>): TData {
    if ("incremental" in chunk && isNonEmptyArray(chunk.incremental)) {
      return mergeIncrementalData(data as any, chunk);

      // Detect the first chunk of a deferred query and merge it with existing
      // cache data. This ensures a `cache-first` fetch policy that returns
      // partial cache data or a `cache-and-network` fetch policy that already
      // has full data in the cache does not complain when trying to merge the
      // initial deferred server data with existing cache data.
    } else if ("hasNext" in chunk && chunk.hasNext) {
      const merger = new DeepMerger();
      return merger.merge(data, chunk.data);
    }
  }

  prepareRequest(request: GraphQLRequest) {
    return request;
  }
}
