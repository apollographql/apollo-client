import 'whatwg-fetch';

// This is an implementation of a mocked window.fetch implementation similar in
// structure to the MockedNetworkInterface.

export interface MockedIResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  json(): Promise<Object>;
}

export interface MockedFetchResponse {
  url: string;
  opts: RequestInit;
  result: MockedIResponse;
  delay?: number;
}

export function createMockedIResponse(
  result: Object,
  options?: any,
): MockedIResponse {
  const status = (options && options.status) || 200;
  const statusText = (options && options.statusText) || undefined;

  return {
    ok: status === 200,
    status,
    statusText,
    json() {
      return Promise.resolve<Object>(result);
    },
  };
}

export class MockFetch {
  private mockedResponsesByKey: { [key: string]: MockedFetchResponse[] };

  constructor(...mockedResponses: MockedFetchResponse[]) {
    this.mockedResponsesByKey = {};

    mockedResponses.forEach(mockedResponse => {
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
      throw new Error(
        `No more mocked fetch responses for the params ${url} and ${opts}`,
      );
    }

    const { result, delay } = responses.shift()!;

    if (!result) {
      throw new Error(`Mocked fetch response should contain a result.`);
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(result);
      }, delay ? delay : 0);
    });
  }

  public fetchParamsToKey(url: string, opts: RequestInit): string {
    return JSON.stringify({
      url,
      opts: sortByKey(opts),
    });
  }

  // Returns a "fetch" function equivalent that mocks the given responses.
  // The function by returned by this should be tacked onto the global scope
  // inorder to test functions that use "fetch".
  public getFetch() {
    return this.fetch.bind(this);
  }
}

function sortByKey(obj: any): Object {
  return Object.keys(obj)
    .sort()
    .reduce(
      (ret: any, key: string): Object =>
        Object.assign(
          {
            [key]:
              Object.prototype.toString.call(obj[key]).slice(8, -1) === 'Object'
                ? sortByKey(obj[key])
                : obj[key],
          },
          ret,
        ),
      {},
    );
}

export function createMockFetch(...mockedResponses: MockedFetchResponse[]) {
  return new MockFetch(...mockedResponses).getFetch();
}
