import {
  NetworkInterface,
  Request,
} from '../../src/networkInterface';

import {
  GraphQLResult,
  parse,
  print
} from 'graphql';

export interface MockedResponse {
  request: Request
  result: GraphQLResult
  delay?: number
}

// Pass in an array of requests and responses, so that you can test flows that end up making
// multiple queries to the server
export default function mockNetworkInterface(
  ...mockedResponses: MockedResponse[]
) {
  const requestToResultMap: any = {};
  const requestToDelayMap: any = {};

  // Populate set of mocked requests
  mockedResponses.forEach(({ request, result, delay }) => {
    requestToResultMap[requestToKey(request)] = result as GraphQLResult;
    requestToDelayMap[requestToKey(request)] = delay;
  });

  // A mock for the query method
  const queryMock = (request: Request) => {
    return new Promise((resolve, reject) => {
      const resultData = requestToResultMap[requestToKey(request)];
      const delay = requestToDelayMap[requestToKey(request)];

      if (! resultData) {
        throw new Error(`Passed request that wasn't mocked: ${requestToKey(request)}`);
      }

      setTimeout(() => {
        resolve(resultData);
      }, delay ? delay : 0);
    });
  };

  return {
    query: queryMock,
  } as NetworkInterface;
}

function requestToKey(request: Request): string {
  const query = request.query && print(parse(request.query));

  return JSON.stringify({
    variables: request.variables,
    debugName: request.debugName,
    query,
  });
}
