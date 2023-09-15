import gql from "graphql-tag";

import { ApolloLink } from "../../core";
import { Observable } from "../../../utilities/observables/Observable";
import { execute } from "../../core/execute";
import { setContext } from "../index";
import { itAsync } from "../../../testing";

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

itAsync(
  "can be used to set the context with a simple function",
  (resolve, reject) => {
    const withContext = setContext(() => ({ dynamicallySet: true }));

    const mockLink = new ApolloLink((operation) => {
      expect(operation.getContext().dynamicallySet).toBe(true);
      return Observable.of({ data });
    });

    const link = withContext.concat(mockLink);

    execute(link, { query }).subscribe((result) => {
      expect(result.data).toEqual(data);
      resolve();
    });
  }
);

itAsync(
  "can be used to set the context with a function returning a promise",
  (resolve, reject) => {
    const withContext = setContext(() =>
      Promise.resolve({ dynamicallySet: true })
    );

    const mockLink = new ApolloLink((operation) => {
      expect(operation.getContext().dynamicallySet).toBe(true);
      return Observable.of({ data });
    });

    const link = withContext.concat(mockLink);

    execute(link, { query }).subscribe((result) => {
      expect(result.data).toEqual(data);
      resolve();
    });
  }
);

itAsync(
  "can be used to set the context with a function returning a promise that is delayed",
  (resolve, reject) => {
    const withContext = setContext(() =>
      sleep(25).then(() => ({ dynamicallySet: true }))
    );

    const mockLink = new ApolloLink((operation) => {
      expect(operation.getContext().dynamicallySet).toBe(true);
      return Observable.of({ data });
    });

    const link = withContext.concat(mockLink);

    execute(link, { query }).subscribe((result) => {
      expect(result.data).toEqual(data);
      resolve();
    });
  }
);

itAsync("handles errors in the lookup correclty", (resolve, reject) => {
  const withContext = setContext(() =>
    sleep(5).then(() => {
      throw new Error("dang");
    })
  );

  const mockLink = new ApolloLink((operation) => {
    return Observable.of({ data });
  });

  const link = withContext.concat(mockLink);

  execute(link, { query }).subscribe(reject, (e) => {
    expect(e.message).toBe("dang");
    resolve();
  });
});
itAsync(
  "handles errors in the lookup correclty with a normal function",
  (resolve, reject) => {
    const withContext = setContext(() => {
      throw new Error("dang");
    });

    const mockLink = new ApolloLink((operation) => {
      return Observable.of({ data });
    });

    const link = withContext.concat(mockLink);

    execute(link, { query }).subscribe(reject, (e) => {
      expect(e.message).toBe("dang");
      resolve();
    });
  }
);

itAsync("has access to the request information", (resolve, reject) => {
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
    return Observable.of({ data });
  });

  const link = withContext.concat(mockLink);

  execute(link, { query, variables: { id: 1 } }).subscribe((result) => {
    expect(result.data).toEqual(data);
    resolve();
  });
});
itAsync("has access to the context at execution time", (resolve, reject) => {
  const withContext = setContext((_, { count }) =>
    sleep(1).then(() => ({ count: count + 1 }))
  );

  const mockLink = new ApolloLink((operation) => {
    const { count } = operation.getContext();
    expect(count).toEqual(2);
    return Observable.of({ data });
  });

  const link = withContext.concat(mockLink);

  execute(link, { query, context: { count: 1 } }).subscribe((result) => {
    expect(result.data).toEqual(data);
    resolve();
  });
});

itAsync("unsubscribes correctly", (resolve, reject) => {
  const withContext = setContext((_, { count }) =>
    sleep(1).then(() => ({ count: count + 1 }))
  );

  const mockLink = new ApolloLink((operation) => {
    const { count } = operation.getContext();
    expect(count).toEqual(2);
    return Observable.of({ data });
  });

  const link = withContext.concat(mockLink);

  let handle = execute(link, {
    query,
    context: { count: 1 },
  }).subscribe((result) => {
    expect(result.data).toEqual(data);
    handle.unsubscribe();
    resolve();
  });
});

itAsync("unsubscribes without throwing before data", (resolve, reject) => {
  let called: boolean;
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
    reject("should have unsubscribed");
  });

  setTimeout(() => {
    handle.unsubscribe();
    expect(called).toBe(true);
    resolve();
  }, 10);
});

itAsync(
  "does not start the next link subscription if the upstream subscription is already closed",
  (resolve, reject) => {
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
      reject("link should not be called");
      return new Observable((observer) => {
        observer.error("link should not have been observed");
      });
    });

    const link = withContext.concat(mockLink);

    let subscriptionReturnedData = false;
    let handle = execute(link, { query }).subscribe((result) => {
      subscriptionReturnedData = true;
      reject("subscription should not return data");
    });

    handle.unsubscribe();

    setTimeout(() => {
      expect(promiseResolved).toBe(true);
      expect(mockLinkCalled).toBe(false);
      expect(subscriptionReturnedData).toBe(false);
      resolve();
    }, 10);
  }
);
