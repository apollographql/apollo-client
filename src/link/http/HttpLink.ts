import { ApolloLink, RequestHandler } from '../core/index.js';
import { HttpOptions } from './selectHttpOptionsAndBody.js';
import { createHttpLink } from './createHttpLink.js';

export class HttpLink extends ApolloLink {
  public requester: RequestHandler;
  constructor(public options: HttpOptions = {}) {
    super(createHttpLink(options).request);
  }
}
