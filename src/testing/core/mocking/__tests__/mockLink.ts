import gql from "graphql-tag";
import { MockLink, MockedResponse } from "../mockLink";
import { execute } from "../../../../link/core/execute";
import { ObservableStream } from "../../../internal";

describe("MockedResponse.newData", () => {
  const setup = () => {
    const weaklyTypedMockResponse: MockedResponse = {
      request: {
        query: gql`
          query A {
            a
          }
        `,
      },
    };

    const stronglyTypedMockResponse: MockedResponse<
      { a: string },
      { input: string }
    > = {
      request: {
        query: gql`
          query A {
            a
          }
        `,
      },
    };

    return {
      weaklyTypedMockResponse,
      stronglyTypedMockResponse,
    };
  };

  test("returned 'data' can be any object with untyped response", () => {
    const { weaklyTypedMockResponse } = setup();

    weaklyTypedMockResponse.newData = ({ fake: { faker } }) => ({
      data: {
        pretend: faker,
      },
    });
  });

  test("can't return output that doesn't match TData", () => {
    const { stronglyTypedMockResponse } = setup();

    // @ts-expect-error return type does not match `TData`
    stronglyTypedMockResponse.newData = () => ({
      data: {
        a: 123,
      },
    });
  });

  test("can't use input variables that don't exist in TVariables", () => {
    const { stronglyTypedMockResponse } = setup();

    // @ts-expect-error unknown variables
    stronglyTypedMockResponse.newData = ({ fake: { faker } }) => ({
      data: {
        a: faker,
      },
    });
  });
});

/*
We've chosen this value as the MAXIMUM_DELAY since values that don't fit into a 32-bit signed int cause setTimeout to fire immediately
*/
const MAXIMUM_DELAY = 0x7f_ff_ff_ff;

describe("mockLink", () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  const query = gql`
    query A {
      a
    }
  `;

  it("should not require a result or error when delay equals Infinity", async () => {
    const mockLink = new MockLink([
      {
        request: {
          query,
        },
        delay: Infinity,
      },
    ]);

    const observable = execute(mockLink, { query });

    const subscription = observable.subscribe(
      () => fail("onNext was called"),
      () => fail("onError was called"),
      () => fail("onComplete was called")
    );
    jest.advanceTimersByTime(MAXIMUM_DELAY);
    subscription.unsubscribe();
  });

  it("should require result or error when delay is just large", (done) => {
    const mockLink = new MockLink([
      {
        request: {
          query,
        },
        delay: MAXIMUM_DELAY,
      },
    ]);

    execute(mockLink, { query }).subscribe(
      () => fail("onNext was called"),
      (error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(
          /^Mocked response should contain either `result`, `error` or a `delay` of `Infinity`: /
        );
        done();
      }
    );

    jest.advanceTimersByTime(MAXIMUM_DELAY);
  });
});

test("removes @nonreactive directives from fields", async () => {
  const serverQuery = gql`
    query A {
      a
      b
      c
    }
  `;

  const link = new MockLink([
    {
      request: {
        query: gql`
          query A {
            a
            b
            c @nonreactive
          }
        `,
      },
      result: { data: { a: 1, b: 2, c: 3 } },
    },
    {
      request: {
        query: gql`
          query A {
            a
            b
            c
          }
        `,
      },
      result: { data: { a: 4, b: 5, c: 6 } },
    },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream.takeNext()).resolves.toEqual({
      data: { a: 1, b: 2, c: 3 },
    });
  }

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream.takeNext()).resolves.toEqual({
      data: { a: 4, b: 5, c: 6 },
    });
  }
});

test("removes @connection directives", async () => {
  const serverQuery = gql`
    query A {
      a
      b
      c
    }
  `;

  const link = new MockLink([
    {
      request: {
        query: gql`
          query A {
            a
            b
            c @connection(key: "test")
          }
        `,
      },
      result: { data: { a: 1, b: 2, c: 3 } },
    },
    {
      request: {
        query: gql`
          query A {
            a
            b
            c
          }
        `,
      },
      result: { data: { a: 4, b: 5, c: 6 } },
    },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream.takeNext()).resolves.toEqual({
      data: { a: 1, b: 2, c: 3 },
    });
  }

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream.takeNext()).resolves.toEqual({
      data: { a: 4, b: 5, c: 6 },
    });
  }
});

test("removes fields with @client directives", async () => {
  const serverQuery = gql`
    query A {
      a
      b
    }
  `;

  const link = new MockLink([
    {
      request: {
        query: gql`
          query A {
            a
            b
            c @client
          }
        `,
      },
      result: { data: { a: 1, b: 2 } },
    },
    {
      request: {
        query: gql`
          query A {
            a
            b
          }
        `,
      },
      result: { data: { a: 3, b: 4 } },
    },
  ]);

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream.takeNext()).resolves.toEqual({ data: { a: 1, b: 2 } });
  }

  {
    const stream = new ObservableStream(execute(link, { query: serverQuery }));

    await expect(stream.takeNext()).resolves.toEqual({ data: { a: 3, b: 4 } });
  }
});

describe.skip("type tests", () => {
  const ANY = {} as any;
  test("covariant behaviour: `MockedResponses<X,Y>` should be assignable to `MockedResponse`", () => {
    let unspecificArray: MockedResponse[] = [];
    let specificArray: MockedResponse<{ foo: string }, { foo: string }>[] = [];
    let unspecificResponse: MockedResponse = ANY;
    let specificResponse: MockedResponse<{ foo: string }, { foo: string }> =
      ANY;

    unspecificArray.push(specificResponse);
    unspecificArray.push(unspecificResponse);

    specificArray.push(specificResponse);
    // @ts-expect-error
    specificArray.push(unspecificResponse);

    unspecificArray = [specificResponse];
    unspecificArray = [unspecificResponse];
    unspecificArray = [specificResponse, unspecificResponse];

    specificArray = [specificResponse];
    // @ts-expect-error
    specificArray = [unspecificResponse];
    // @ts-expect-error
    specificArray = [specificResponse, unspecificResponse];

    unspecificResponse = specificResponse;
    // @ts-expect-error
    specificResponse = unspecificResponse;
  });
});
