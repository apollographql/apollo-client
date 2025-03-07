import { ApolloLink } from "@apollo/client/link/core";
import type { HttpOptions } from "./selectHttpOptionsAndBody.js";
import { createHttpLink } from "./createHttpLink.js";

export class HttpLink extends ApolloLink {
  constructor(public options: HttpOptions = {}) {
    super(createHttpLink(options).request);
  }
}
