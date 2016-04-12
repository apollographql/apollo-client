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
  result: GraphQLResult
  delay?: number
}

class MockNetworkInterface {
  private requestToResultMap: any = {};
  private requestToDelayMap: any = {};

  constructor(...mockedResponses: MockedResponse[]) {
    // Populate set of mocked requests
    mockedResponses.forEach(({ request, result, delay }) => {
      this.requestToResultMap[requestToKey(request)] = result as GraphQLResult;
      this.requestToDelayMap[requestToKey(request)] = delay;
    });
  }

  query(request: Request) {
    return new Promise((resolve, reject) => {
      const resultData = this.requestToResultMap[requestToKey(request)];
      const delay = this.requestToDelayMap[requestToKey(request)];

      if (! resultData) {
        throw new Error(`Passed request that wasn't mocked: ${requestToKey(request)}`);
      }

      setTimeout(() => {
        resolve(resultData);
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
