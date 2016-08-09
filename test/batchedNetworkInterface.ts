import { assert } from 'chai';

import { HTTPBatchedNetworkInterface } from '../src/batchedNetworkInterface';

import {
  Request,
  printRequest,
} from '../src/networkInterface';

import { GraphQLResult } from 'graphql';

import 'whatwg-fetch';

import gql from 'graphql-tag';

// This is a hack to let Typescript let us tack stuff onto the global scope.
interface Window {
  fetch: any;
}

export interface MockedIResponse {
  json(): Promise<JSON>;
}

export interface MockedFetchResponse {
  url: string;
  opts: RequestInit;
  result: MockedIResponse;
  delay?: number;
}

export function createMockedIResponse(result: Object): MockedIResponse {
  return {
    json() {
      return Promise.resolve(result);
    },
  };
}

export class MockFetch {
  private mockedResponsesByKey : { [key: string]: MockedFetchResponse[] };

  constructor(...mockedResponses: MockedFetchResponse[]) {
    this.mockedResponsesByKey = {};

    mockedResponses.forEach((mockedResponse) => {
      this.addMockedResponse(mockedResponse);
    });
  }

  public addMockedResponse(mockedResponse: MockedFetchResponse) {
    const key = this.fetchParamsToKey(mockedResponse.url, mockedResponse.opts);
    let mockedResponses = this.mockedResponsesByKey[key];

    if (!mockedResponses) {
      mockedResponses = [];
      this.mockedResponsesByKey[key] = mockedResponses;
    }

    mockedResponses.push(mockedResponse);
  }

  public fetch(url: string, opts: RequestInit) {
    const key = this.fetchParamsToKey(url, opts);
    const responses = this.mockedResponsesByKey[key];

    if (!responses || responses.length === 0) {
      throw new Error(`No more mocked fetch responses for the params ${url} and ${opts}`);
    }

    const { result, delay } = responses.shift();

    if (!result) {
      throw new Error(`Mocked fetch response should contain a result.`);
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(result);
      }, delay ? delay: 0);
    });
  }

  public fetchParamsToKey(url: string, opts: RequestInit): string {
    return JSON.stringify({
      url,
      opts,
    });
  }

  // Returns a "fetch" function equivalent that mocks the given responses.
  // The function by returned by this should be tacked onto the global scope
  // inorder to test functions that use "fetch".
  public getFetch() {
    return this.fetch.bind(this);
  }
}


describe('HTTPBatchedNetworkInterface', () => {
  // Helper method that tests a roundtrip given a particular set of requests to the
  // batched network interface and the
  const assertRoundtrip = (...requestResultPairs: {
    request: Request,
    result: GraphQLResult,
  }[]) => {
    const url = 'http://fake.com/graphql';
    const opts = {};

    const batchedNetworkInterface = new HTTPBatchedNetworkInterface(url, opts);
    const printedRequests = [];
    const resultList = [];
    requestResultPairs.forEach(({ request, result }) => {
      printedRequests.push(printRequest(request));
      resultList.push(result);
    });

    const mockedFetch = new MockFetch({
      url,
      opts: {
        body: JSON.stringify(printedRequests),
        headers:  {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      result: createMockedIResponse(resultList),
    });
    fetch = mockedFetch.getFetch();

    return batchedNetworkInterface.batchQuery(requestResultPairs.map(({ request }) => request))
      .then((results) => {
        assert.deepEqual(results, resultList);
      });
  };

  it('should construct itself correctly', () => {
    const url = 'http://notreal.com/graphql';
    const opts = {};
    const batchedNetworkInterface = new HTTPBatchedNetworkInterface(url, opts);
    assert(batchedNetworkInterface);
    assert.equal(batchedNetworkInterface._uri, url);
    assert.deepEqual(batchedNetworkInterface._opts, opts);
    assert(batchedNetworkInterface.batchQuery);
  });

  it('should correctly return the result for a single request', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const result = {
      data: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    return assertRoundtrip({
      request: { query },
      result,
    });
  });
});
