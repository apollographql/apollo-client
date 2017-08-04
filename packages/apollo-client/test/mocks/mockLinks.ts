import { ExecutionResult, DocumentNode } from 'graphql';

import {
  Operation,
  ApolloLink,
  execute,
  FetchResult,
  Observable,
} from 'apollo-link-core';

import { print } from 'graphql/language/printer';

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server
export function mockSingleLink(
  ...mockedResponses: MockedResponse[]
): ApolloLink {
  return new MockLink(mockedResponses);
}

// export function mockSubscriptionLink(
//   mockedSubscriptions: MockedSubscription[],
//   ...mockedResponses: MockedResponse[]
// ): MockSubscriptionLink {
//   return new MockSubscriptionLink(mockedSubscriptions, mockedResponses);
// }

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
  results?: MockedSubscriptionResult[];
  id?: number;
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

// export class MockSubscriptionLink extends MockLink {
//   public mockedSubscriptionsByKey: { [key: string]: MockedSubscription[] } = {};
//   public mockedSubscriptionsById: { [id: number]: MockedSubscription } = {};
//   public handlersById: { [id: number]: (error: any, result: any) => void } = {};
//   public subId: number;

//   constructor(
//     mockedSubscriptions: MockedSubscription[],
//     mockedResponses: MockedResponse[],
//   ) {
//     super(mockedResponses);
//     this.subId = 0;
//     mockedSubscriptions.forEach(sub => {
//       this.addMockedSubscription(sub);
//     });
//   }
//   public generateSubscriptionId() {
//     const requestId = this.subId;
//     this.subId++;
//     return requestId;
//   }

//   public addMockedSubscription(mockedSubscription: MockedSubscription) {
//     const key = requestToKey(mockedSubscription.request);
//     if (mockedSubscription.id === undefined) {
//       mockedSubscription.id = this.generateSubscriptionId();
//     }

//     let mockedSubs = this.mockedSubscriptionsByKey[key];
//     if (!mockedSubs) {
//       mockedSubs = [];
//       this.mockedSubscriptionsByKey[key] = mockedSubs;
//     }
//     mockedSubs.push(mockedSubscription);
//   }

//   public subscribe(
//     request: Operation,
//     handler: (error: any, result: any) => void,
//   ): number {
//     const parsedRequest: Operation = {
//       query: request.query,
//       variables: request.variables,
//     };
//     const key = requestToKey(parsedRequest);
//     if (this.mockedSubscriptionsByKey.hasOwnProperty(key)) {
//       const subscription = this.mockedSubscriptionsByKey[key].shift()!;
//       const id = subscription.id!;
//       this.handlersById[id] = handler;
//       this.mockedSubscriptionsById[id] = subscription;
//       return id;
//     } else {
//       throw new Error(
//         'Network interface does not have subscription associated with this request.',
//       );
//     }
//   }

//   public fireResult(id: number) {
//     const handler = this.handlersById[id];
//     if (this.mockedSubscriptionsById.hasOwnProperty(id.toString())) {
//       const subscription = this.mockedSubscriptionsById[id];
//       if (subscription.results!.length === 0) {
//         throw new Error(
//           `No more mocked subscription responses for the query: ` +
//             `${print(subscription.request.query)}, variables: ${JSON.stringify(
//               subscription.request.variables,
//             )}`,
//         );
//       }
//       const response = subscription.results!.shift()!;
//       setTimeout(() => {
//         handler(
//           response.error,
//           response.result ? response.result.data : undefined,
//         );
//       }, response.delay ? response.delay : 0);
//     } else {
//       throw new Error(
//         'Network interface does not have subscription associated with this id.',
//       );
//     }
//   }

//   public unsubscribe(id: number) {
//     delete this.mockedSubscriptionsById[id];
//   }
// }

function requestToKey(request: Operation): string {
  const queryString = request.query && print(request.query);

  return JSON.stringify({
    variables: request.variables || {},
    query: queryString,
  });
}
