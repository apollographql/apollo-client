import { createHttpLink } from "./createHttpLink.js";
import type { HttpOptions } from "./selectHttpOptionsAndBody.js";

import { ApolloLink } from "@apollo/client/link/core";

export class HttpLink extends ApolloLink {
  constructor(public options: HttpOptions = {}) {
    super(createHttpLink(options).request);
  }
}
