import {
  execute,
  makePromise,
  ApolloLink,
  Operation,
  FetchResult,
} from 'apollo-link-core';
import { ExecutionResult } from 'graphql';
import { print } from 'graphql/language/printer';

// XXX can this be a link?
export class Deduplicator {
  private inFlightRequestPromises: { [key: string]: Promise<any> };
  private link: ApolloLink;

  constructor(link: ApolloLink) {
    this.link = link;
    this.inFlightRequestPromises = {};
  }

  public queryLink(request: Operation): Promise<FetchResult> {
    return makePromise(execute(this.link, request));
  }

  public query(request: Operation, deduplicate = true) {
    // sometimes we might not want to deduplicate a request, for example when we want to force fetch it.
    if (!deduplicate) {
      return this.queryLink(request);
    }

    const key = this.getKey(request);
    if (!this.inFlightRequestPromises[key]) {
      this.inFlightRequestPromises[key] = this.queryLink(request);
    }
    return this.inFlightRequestPromises[key]
      .then(res => {
        delete this.inFlightRequestPromises[key];
        return res;
      })
      .catch(err => {
        delete this.inFlightRequestPromises[key];
        throw err;
      });
  }

  private getKey(request: Operation) {
    // XXX we're assuming here that variables will be serialized in the same order.
    // that might not always be true
    return `${print(request.query)}|${JSON.stringify(
      request.variables,
    )}|${request.operationName}`;
  }
}
