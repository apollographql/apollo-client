import {
  ApolloClient,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { MockLink } from "@apollo/client/testing";
import { ObservableStream } from "@apollo/client/testing/internal";

test("maintains data with errorPolicy: none when refetch returns error with no data", async () => {
  const query = gql`
    query people {
      allPeople {
        people {
          name
        }
      }
    }
  `;

  const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data },
        delay: 20,
      },
      {
        request: { query },
        result: { errors: [{ message: "Oops" }] },
        delay: 20,
      },
    ]),
  });

  const observable = client.watchQuery({ query, errorPolicy: "none" });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(observable.refetch()).rejects.toStrictEqualTyped(
    new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] })
  );

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    error: new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] }),
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("returns data as undefined with errorPolicy: all when refetch returns error with no data", async () => {
  const query = gql`
    query people {
      allPeople {
        people {
          name
        }
      }
    }
  `;

  const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data },
        delay: 20,
      },
      {
        request: { query },
        result: { errors: [{ message: "Oops" }] },
        delay: 20,
      },
    ]),
  });

  const observable = client.watchQuery({ query, errorPolicy: "all" });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(observable.refetch()).resolves.toStrictEqualTyped({
    data: undefined,
    error: new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] }),
  });

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    error: new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] }),
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("returns data as undefined with errorPolicy: ignore when refetch returns error with no data", async () => {
  const query = gql`
    query people {
      allPeople {
        people {
          name
        }
      }
    }
  `;

  const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data },
        delay: 20,
      },
      {
        request: { query },
        result: { errors: [{ message: "Oops" }] },
        delay: 20,
      },
    ]),
  });

  const observable = client.watchQuery({ query, errorPolicy: "ignore" });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(observable.refetch()).resolves.toStrictEqualTyped({
    data: undefined,
  });

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: true,
  });

  await expect(stream).not.toEmitAnything();
});
