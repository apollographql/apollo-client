import { gql } from "graphql-tag";
import { Observable, of } from "rxjs";

import { setContext } from "@apollo/client/link/context";
import { ApolloLink, execute } from "@apollo/client/link/core";
import { wait } from "@apollo/client/testing";

import { ObservableStream } from "../../../testing/internal/index.js";

const sleep = (ms: number) => new Promise((s) => setTimeout(s, ms));
const query = gql`
  query Test {
    foo {
      bar
    }
  }
`;
const data = {
  foo: { bar: true },
};

it("can be used to set the context with a simple function", async () => {
  const withContext = setContext(() => ({ dynamicallySet: true }));

  const mockLink = new ApolloLink((operation) => {
    expect(operation.getContext().dynamicallySet).toBe(true);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitValue({ data });
});

it("can be used to set the context with a function returning a promise", async () => {
  const withContext = setContext(() =>
    Promise.resolve({ dynamicallySet: true })
  );

  const mockLink = new ApolloLink((operation) => {
    expect(operation.getContext().dynamicallySet).toBe(true);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitValue({ data });
});

it("can be used to set the context with a function returning a promise that is delayed", async () => {
  const withContext = setContext(() =>
    sleep(25).then(() => ({ dynamicallySet: true }))
  );

  const mockLink = new ApolloLink((operation) => {
    expect(operation.getContext().dynamicallySet).toBe(true);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitValue({ data });
});

it("handles errors in the lookup correclty", async () => {
  const withContext = setContext(() =>
    sleep(5).then(() => {
      throw new Error("dang");
    })
  );

  const mockLink = new ApolloLink((operation) => {
    return of({ data });
  });

  const link = withContext.concat(mockLink);

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError("dang");
});

it("handles errors in the lookup correctly with a normal function", async () => {
  const withContext = setContext(() => {
    throw new Error("dang");
  });

  const mockLink = new ApolloLink((operation) => {
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError("dang");
});

it("has access to the request information", async () => {
  const withContext = setContext(({ operationName, query, variables }) =>
    sleep(1).then(() =>
      Promise.resolve({
        variables: variables ? true : false,
        operation: query ? true : false,
        operationName: operationName!.toUpperCase(),
      })
    )
  );

  const mockLink = new ApolloLink((op) => {
    const { variables, operation, operationName } = op.getContext();
    expect(variables).toBe(true);
    expect(operation).toBe(true);
    expect(operationName).toBe("TEST");
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 1 } })
  );

  await expect(stream).toEmitValue({ data });
});

it("has access to the context at execution time", async () => {
  const withContext = setContext((_, { count }) =>
    sleep(1).then(() => ({ count: count + 1 }))
  );

  const mockLink = new ApolloLink((operation) => {
    const { count } = operation.getContext();
    expect(count).toEqual(2);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(
    execute(link, { query, context: { count: 1 } })
  );

  await expect(stream).toEmitValue({ data });
});

it("unsubscribes correctly", async () => {
  const withContext = setContext((_, { count }) =>
    sleep(1).then(() => ({ count: count + 1 }))
  );

  const mockLink = new ApolloLink((operation) => {
    const { count } = operation.getContext();
    expect(count).toEqual(2);
    return of({ data });
  });

  const link = withContext.concat(mockLink);

  const stream = new ObservableStream(
    execute(link, {
      query,
      context: { count: 1 },
    })
  );

  await expect(stream).toEmitValue({ data });
  stream.unsubscribe();
});

it("unsubscribes without throwing before data", async () => {
  let called!: boolean;
  const withContext = setContext((_, { count }) => {
    called = true;
    return sleep(1).then(() => ({ count: count + 1 }));
  });

  const mockLink = new ApolloLink((operation) => {
    const { count } = operation.getContext();
    expect(count).toEqual(2);
    return new Observable((obs) => {
      setTimeout(() => {
        obs.next({ data });
        obs.complete();
      }, 25);
    });
  });

  const link = withContext.concat(mockLink);

  let handle = execute(link, {
    query,
    context: { count: 1 },
  }).subscribe((result) => {
    throw new Error("should have unsubscribed");
  });

  await wait(10);

  handle.unsubscribe();
  expect(called).toBe(true);
});

it("does not start the next link subscription if the upstream subscription is already closed", async () => {
  let promiseResolved = false;
  const withContext = setContext(() =>
    sleep(5).then(() => {
      promiseResolved = true;
      return { dynamicallySet: true };
    })
  );

  let mockLinkCalled = false;
  const mockLink = new ApolloLink(() => {
    mockLinkCalled = true;
    throw new Error("link should not be called");
  });

  const link = withContext.concat(mockLink);

  let subscriptionReturnedData = false;
  let handle = execute(link, { query }).subscribe((result) => {
    subscriptionReturnedData = true;
    throw new Error("subscription should not return data");
  });

  handle.unsubscribe();

  await wait(10);

  expect(promiseResolved).toBe(true);
  expect(mockLinkCalled).toBe(false);
  expect(subscriptionReturnedData).toBe(false);
});
