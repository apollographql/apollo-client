import {
  Operation,
  ApolloLink,
  FetchResult,
  Observable,
  GraphQLRequest,
} from 'apollo-link';

import { print } from 'graphql/language/printer';

interface MockApolloLink extends ApolloLink {
  operation?: Operation;
}

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server
export function mockSingleLink(
  ...mockedResponses: MockedResponse[]
): MockApolloLink {
  return new MockLink(mockedResponses);
}

export function mockObservableLink(): MockSubscriptionLink {
  return new MockSubscriptionLink();
}

export interface MockedResponse {
  request: GraphQLRequest;
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
  public operation: Operation;
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
    this.operation = operation;
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
      let timer = setTimeout(
        () => {
          if (error) {
            observer.error(error);
          } else {
            if (result) observer.next(result);
            observer.complete();
          }
        },
        delay ? delay : 0,
      );

      return () => {
        clearTimeout(timer);
      };
    });
  }
}

export class MockSubscriptionLink extends ApolloLink {
  // private observer: Observer<any>;
  private observer: any;
  public unsubscribers: any[] = [];
  public setups: any[] = [];

  constructor() {
    super();
  }

  public request() {
    return new Observable<FetchResult>(observer => {
      this.setups.forEach(x => x());
      this.observer = observer;
      return {
        unsubscribe: () => {
          this.unsubscribers.forEach(x => x());
        },
        closed: false,
      };
    });
  }

  public simulateResult(result: MockedSubscriptionResult) {
    setTimeout(() => {
      const { observer } = this;
      if (!observer) throw new Error('subscription torn down');
      if (result.result && observer.next) observer.next(result.result);
      if (result.error && observer.error) observer.error(result.error);
    }, result.delay || 0);
  }

  public simulateComplete() {
    const { observer } = this;
    if (!observer) throw new Error('subscription torn down');
    if (observer.complete) observer.complete();
  }

  public onSetup(listener: any): void {
    this.setups = this.setups.concat([listener]);
  }

  public onUnsubscribe(listener: any): void {
    this.unsubscribers = this.unsubscribers.concat([listener]);
  }
}

function requestToKey(request: GraphQLRequest): string {
  const queryString = request.query && print(request.query);

  return JSON.stringify({
    variables: request.variables || {},
    query: queryString,
  });
}
