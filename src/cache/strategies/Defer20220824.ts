import type {
  ExecutionPatchResult,
  GraphQLRequest,
  HttpLink,
} from "@apollo/client";
import { hasDirectives } from "@apollo/client/utilities/internal";

import type { Cache } from "../core/types/Cache.js";

export class Defer20220824 implements Cache.IncrementalStrategy {
  merge<TData>(accumulated: TData, chunk: ExecutionPatchResult<TData>) {
    return; // ...
  }

  prepareRequest(request: GraphQLRequest) {
    if (hasDirectives(["defer"], request.query)) {
      const context = request.context as HttpLink.ContextOptions;
      const http = (context.http ??= {});
      http.accept = [
        "multipart/mixed;deferSpec=20220824;q=1.1",
        ...(http.accept || []),
      ];
    }

    return request;
  }
}
