import { ExecutionResult, DocumentNode } from 'graphql';

import {
  Operation,
  ApolloLink,
  execute,
  FetchResult,
  Observable,
  Observer,
} from 'apollo-link-core';

import { print } from 'graphql/language/printer';

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server
export function mockSingleLink(
  ...mockedResponses: MockedResponse[]
): ApolloLink {
  return new MockLink(mockedResponses);
}

export function mockObservableLink(
  mockedSubscription: MockedSubscription,
): MockSubscriptionLink {
  return new MockSubscriptionLink(mockedSubscription);
}

export interface MockedResponse {
  request: Operation;
  result?: FetchResult;
  error?: Error;
  delay?: number;
}

export interface MockedSubscriptionResult {
  result?: FetchResult;
  error?: Error;
  delay?: number;
}

export interface MockedSubscription {
  request: Operation;
}

export class MockLink extends ApolloLink {
  private mockedResponsesByKey: { [key: string]: MockedResponse[] } = {};

  constructor(mockedResponses: MockedResponse[]) {
    super();
    mockedResponses.forEach(mockedResponse => {
      this.addMockedResponse(mockedResponse);
    });
  }

  public addMockedResponse(mockedResponse: MockedResponse) {
    const key = requestToKey(mockedResponse.request);
    let mockedResponses = this.mockedResponsesByKey[key];
    if (!mockedResponses) {
      mockedResponses = [];
      this.mockedResponsesByKey[key] = mockedResponses;
    }
    mockedResponses.push(mockedResponse);
  }

  public request(operation: Operation) {
    const key = requestToKey(operation);
    const responses = this.mockedResponsesByKey[key];
    if (!responses || responses.length === 0) {
      throw new Error(
        `No more mocked responses for the query: ${print(
          operation.query,
        )}, variables: ${JSON.stringify(operation.variables)}`,
      );
    }

    const { result, error, delay } = responses.shift()!;
    if (!result && !error) {
      throw new Error(
        `Mocked response should contain either result or error: ${key}`,
      );
    }

    return new Observable<FetchResult>(observer => {
      let timer = setTimeout(() => {
        if (error) {
          observer.error(error);
        } else {
          if (result) observer.next(result);
          observer.complete();
        }
      }, delay ? delay : 0);

      return () => {
        clearTimeout(timer);
      };
    });
  }
}

export class MockSubscriptionLink extends ApolloLink {
  public mockedSubscription: MockedSubscription;
  private observer: Observer<any>;

  constructor(mockedSubscription: MockedSubscription) {
    super();
    this.mockedSubscription = mockedSubscription;
  }

  public request(operation: Operation) {
    return new Observable<FetchResult>(observer => {
      this.observer = observer;
    });
  }

  public simulateResult(result: MockedSubscriptionResult) {
    const { observer } = this;
    setTimeout(() => {
      if (result.result && !result.error && observer.next)
        observer.next(result.result);

      if (result.error && observer.error) observer.error(result.error);
    }, result.delay || 0);
  }
}

function requestToKey(request: Operation): string {
  const queryString = request.query && print(request.query);

  return JSON.stringify({
    variables: request.variables || {},
    query: queryString,
  });
}
