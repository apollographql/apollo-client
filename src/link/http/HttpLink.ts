import { ApolloLink } from "@apollo/client/link/core";

import { createHttpLink } from "./createHttpLink.js";
import type { HttpOptions, UriFunction } from "./selectHttpOptionsAndBody.js";

export declare namespace HttpLink {
  export interface ContextOptions {
    uri?: string | UriFunction;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
  }
}

export class HttpLink extends ApolloLink {
  constructor(public options: HttpOptions = {}) {
    super(createHttpLink(options).request);
  }
}
