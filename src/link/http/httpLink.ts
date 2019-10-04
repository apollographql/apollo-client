import { ApolloLink, RequestHandler } from '../core';
import { HttpOptions } from './selectHttpOptionsAndBody';
import { createHttpLink } from './createHttpLink';

export class HttpLink extends ApolloLink {
  public requester: RequestHandler;
  constructor(opts?: HttpOptions) {
    super(createHttpLink(opts).request);
  }
}
