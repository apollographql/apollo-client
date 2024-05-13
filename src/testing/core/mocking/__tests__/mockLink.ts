import gql from "graphql-tag";
import { MockLink, MockedResponse } from "../mockLink";
import { execute } from "../../../../link/core/execute";
import { ObservableStream, spyOnConsole } from "../../../internal";

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
  const query = gql`
    query A {
      a
      b
      c @nonreactive
    }
  `;

  const link = new MockLink([
    {
      request: { query },
      result: { data: { a: 1, b: 2, c: 3 } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
  ]);

  {
    const stream = new ObservableStream(
      execute(link, {
        query: gql`
          query A {
            a
            b
            c
          }
        `,
      })
    );

    await expect(stream.takeNext()).resolves.toEqual({
      data: { a: 1, b: 2, c: 3 },
    });
  }

  {
    using spy = spyOnConsole("warn");
    const stream = new ObservableStream(execute(link, { query }));

    expect(spy.warn).toHaveBeenCalledTimes(1);
    expect(spy.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^No more mocked responses for the query/)
    );

    await expect(stream.takeError()).resolves.toEqual(expect.any(Error));
  }
});

test("removes @connection directives", async () => {
  const query = gql`
    query A {
      a
      b
      c @connection(key: "test")
    }
  `;

  const link = new MockLink([
    {
      request: { query },
      result: { data: { a: 1, b: 2, c: 3 } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
  ]);

  {
    const stream = new ObservableStream(
      execute(link, {
        query: gql`
          query A {
            a
            b
            c
          }
        `,
      })
    );

    await expect(stream.takeNext()).resolves.toEqual({
      data: { a: 1, b: 2, c: 3 },
    });
  }

  {
    using spy = spyOnConsole("warn");
    const stream = new ObservableStream(execute(link, { query }));

    expect(spy.warn).toHaveBeenCalledTimes(1);
    expect(spy.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^No more mocked responses for the query/)
    );

    await expect(stream.takeError()).resolves.toEqual(expect.any(Error));
  }
});

test("removes fields with @client directives", async () => {
  const query = gql`
    query A {
      a
      b
      c @client
    }
  `;

  const link = new MockLink([
    {
      request: { query },
      result: { data: { a: 1, b: 2 } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
  ]);

  {
    const stream = new ObservableStream(
      execute(link, {
        query: gql`
          query A {
            a
            b
          }
        `,
      })
    );

    await expect(stream.takeNext()).resolves.toEqual({ data: { a: 1, b: 2 } });
  }

  {
    using spy = spyOnConsole("warn");
    const stream = new ObservableStream(
      execute(link, {
        query: gql`
          query A {
            a
            b
            c @client
          }
        `,
      })
    );

    expect(spy.warn).toHaveBeenCalledTimes(1);
    expect(spy.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^No more mocked responses for the query/)
    );

    await expect(stream.takeError()).resolves.toEqual(expect.any(Error));
  }
});

test("leaves query as-is when removeClientOnlyDirectives is false", async () => {
  const query = gql`
    query A {
      a
      b @client
      c @nonreactive
      d @connection(key: "test")
    }
  `;

  const link = new MockLink(
    [
      {
        request: { query },
        result: { data: { a: 1, c: 3, d: 4 } },
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ],
    true,
    { removeClientOnlyDirectives: false }
  );

  {
    using spy = spyOnConsole("warn");
    const stream = new ObservableStream(
      execute(link, {
        query: gql`
          query A {
            a
            c
            d
          }
        `,
      })
    );

    expect(spy.warn).toHaveBeenCalledTimes(1);
    expect(spy.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^No more mocked responses for the query/)
    );

    await expect(stream.takeError()).resolves.toEqual(expect.any(Error));
  }

  {
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream.takeNext()).resolves.toEqual({
      data: { a: 1, b: 2, c: 3, d: 4 },
    });
  }
});
