import {
  NetworkInterface,
  Request,
} from '../../src/networkInterface';

import {
  GraphQLResult,
  parse,
  print
} from 'graphql';

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server
export default function mockNetworkInterface(
  ...mockedResponses: MockedResponse[]
): NetworkInterface { return new MockNetworkInterface(...mockedResponses) as any }

export interface MockedResponse {
  request: Request
  result?: GraphQLResult
  error?: Error
  delay?: number
}

class MockNetworkInterface {
  private mockedResponsesByKey: { [key:string]: MockedResponse } = {};

  constructor(...mockedResponses: MockedResponse[]) {
    mockedResponses.forEach((mockedResponse) => {
      const key = requestToKey(mockedResponse.request);
      this.mockedResponsesByKey[key] = mockedResponse;
    });
  }

  query(request: Request) {
    return new Promise((resolve, reject) => {
      const key = requestToKey(request);
      const { result, error, delay } = this.mockedResponsesByKey[key];

      if (!result && !error) {
        throw new Error(`Mocked response should contain either result or error: ${key}`);
      }

      setTimeout(() => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }, delay ? delay : 0);
    });
  }
}

function requestToKey(request: Request): string {
  const query = request.query && print(parse(request.query));

  return JSON.stringify({
    variables: request.variables,
    debugName: request.debugName,
    query,
  });
}
