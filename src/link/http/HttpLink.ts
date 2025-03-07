import { ApolloLink } from "@apollo/client/link/core";

import { createHttpLink } from "./createHttpLink.js";
import type { HttpOptions } from "./selectHttpOptionsAndBody.js";


export class HttpLink extends ApolloLink {
  constructor(public options: HttpOptions = {}) {
    super(createHttpLink(options).request);
  }
}
