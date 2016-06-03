import {
  NetworkInterface,
  Request,
} from '../../src/networkInterface';

import {
  GraphQLResult,
  Document,
  parse,
  print,
} from 'graphql';

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server
export default function mockNetworkInterface(
  ...mockedResponses: MockedResponse[]
): NetworkInterface {
  return new MockNetworkInterface(...mockedResponses);
}

export interface ParsedRequest {
  variables?: Object;
  query?: Document;
  debugName?: string;
}

export interface MockedResponse {
  request: ParsedRequest;
  result?: GraphQLResult;
  error?: Error;
  delay?: number;
}

export class MockNetworkInterface implements NetworkInterface {
  private mockedResponsesByKey: { [key: string]: MockedResponse[] } = {};

  constructor(...mockedResponses: MockedResponse[]) {
    mockedResponses.forEach((mockedResponse) => {
      this.addMockedReponse(mockedResponse);
    });
  }

  public addMockedReponse(mockedResponse: MockedResponse) {
    const key = requestToKey(mockedResponse.request);
    let mockedResponses = this.mockedResponsesByKey[key];
    if (!mockedResponses) {
      mockedResponses = [];
      this.mockedResponsesByKey[key] = mockedResponses;
    }
    mockedResponses.push(mockedResponse);
  }

  public query(request: Request) {
    return new Promise((resolve, reject) => {
      const parsedRequest: ParsedRequest = {
        query: parse(request.query),
        variables: request.variables,
        debugName: request.debugName,
      };

      const key = requestToKey(parsedRequest);

      if (!this.mockedResponsesByKey[key]) {
        throw new Error('No more mocked responses for the query: ' + request.query);
      }

      const { result, error, delay } = this.mockedResponsesByKey[key].shift();

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

function requestToKey(request: ParsedRequest): string {
  const queryString = request.query && print(request.query);

  return JSON.stringify({
    variables: request.variables,
    debugName: request.debugName,
    query: queryString,
  });
}
