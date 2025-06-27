import { gql } from "graphql-tag";
import { Observable, of } from "rxjs";

import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import { setContext, SetContextLink } from "@apollo/client/link/context";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  wait,
} from "@apollo/client/testing/internal";

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
  const withContext = new SetContextLink(() => ({ dynamicallySet: true }));

  const mockLink = new ApolloLink((operation) => {
    expect(operation.getContext().dynamicallySet).toBe(true);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data });
});

test("`setContext` can be used to create a `SetContextLink`", async () => {
  const withContext = setContext(() => ({ dynamicallySet: true }));
  expect(withContext).toBeInstanceOf(SetContextLink);

  const mockLink = new ApolloLink((operation) => {
    expect(operation.getContext().dynamicallySet).toBe(true);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data });
});

it("can be used to set the context with a function returning a promise", async () => {
  const withContext = new SetContextLink(() =>
    Promise.resolve({ dynamicallySet: true })
  );

  const mockLink = new ApolloLink((operation) => {
    expect(operation.getContext().dynamicallySet).toBe(true);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data });
});

it("can be used to set the context with a function returning a promise that is delayed", async () => {
  const withContext = new SetContextLink(() =>
    wait(25).then(() => ({ dynamicallySet: true }))
  );

  const mockLink = new ApolloLink((operation) => {
    expect(operation.getContext().dynamicallySet).toBe(true);
    return of({ data });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data });
});

it("handles errors in the lookup correctly", async () => {
  const withContext = new SetContextLink(() =>
    wait(5).then(() => {
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
  const withContext = new SetContextLink(() => {
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
  const withContext = new SetContextLink(
    (_, { operationName, query, variables }) =>
      wait(1).then(() =>
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

  await expect(stream).toEmitTypedValue({ data });
});

it("has access to the context at execution time", async () => {
  const withContext = new SetContextLink(({ count }) =>
    wait(1).then(() => ({ count: count + 1 }))
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

  await expect(stream).toEmitTypedValue({ data });
});

it("unsubscribes correctly", async () => {
  const withContext = new SetContextLink(({ count }) =>
    wait(1).then(() => ({ count: count + 1 }))
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

  await expect(stream).toEmitTypedValue({ data });
  stream.unsubscribe();
});

it("unsubscribes without throwing before data", async () => {
  let called!: boolean;
  const withContext = new SetContextLink(({ count }) => {
    called = true;
    return wait(1).then(() => ({ count: count + 1 }));
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
  const withContext = new SetContextLink(() =>
    wait(5).then(() => {
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

test("can access the client from operation argument", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const withContext = new SetContextLink((_, operation) => {
    return { client: operation.client };
  });

  const mockLink = new ApolloLink((operation) => {
    return of({ data: operation.getContext() });
  });

  const link = withContext.concat(mockLink);
  const stream = new ObservableStream(execute(link, { query }, { client }));

  const { data } = await stream.takeNext();
  expect(data!.client).toBe(client);
});
