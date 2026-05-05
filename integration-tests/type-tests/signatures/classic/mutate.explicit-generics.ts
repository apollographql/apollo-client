import { ApolloCache, ApolloClient, DocumentNode } from "@apollo/client";
import { expectTypeOf } from "expect-type";
import { test } from "./shared.js";

interface Data {
  foo: string;
}

interface Variables {
  bar?: number;
}

declare const client: ApolloClient;
declare const mutation: DocumentNode;

test("returns narrowed TData in default case", () => {
  {
    const result = client.mutate<Data>({ mutation });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables>({ mutation });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables, ApolloCache>({ mutation });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }
});

test('returns narrowed TData with errorPolicy: "none"', () => {
  {
    const result = client.mutate<Data>({ mutation, errorPolicy: "none" });

    // "none" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables>({
      mutation,
      errorPolicy: "none",
    });

    // "none" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables, ApolloCache>({
      mutation,
      errorPolicy: "none",
    });

    // "none" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables, ApolloCache, "none">({
      mutation,
      errorPolicy: "none",
    });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data, "none">>
    >();
  }

  client.mutate<Data, Variables, ApolloCache, "none">(
    // @ts-expect-error missing "errorPolicy" option
    { mutation }
  );

  client.mutate<Data, Variables, ApolloCache, "none">({
    mutation,
    // @ts-expect-error "all" not assignable to "none"
    errorPolicy: "all",
  });
});

test('returns narrowed TData with errorPolicy: "all"', () => {
  {
    const result = client.mutate<Data>({ mutation, errorPolicy: "all" });

    // "all" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables>({
      mutation,
      errorPolicy: "all",
    });

    // "all" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables, ApolloCache>({
      mutation,
      errorPolicy: "all",
    });

    // "all" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables, ApolloCache, "all">({
      mutation,
      errorPolicy: "all",
    });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data, "all">>
    >();
  }

  client.mutate<Data, Variables, ApolloCache, "all">(
    // @ts-expect-error missing "errorPolicy" option
    { mutation }
  );

  client.mutate<Data, Variables, ApolloCache, "all">({
    mutation,
    // @ts-expect-error "none" not assignable to "all"
    errorPolicy: "none",
  });
});

test('returns narrowed TData with errorPolicy: "ignore"', () => {
  {
    const result = client.mutate<Data>({ mutation, errorPolicy: "ignore" });

    // "ignore" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables>({
      mutation,
      errorPolicy: "ignore",
    });

    // "ignore" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables, ApolloCache>({
      mutation,
      errorPolicy: "ignore",
    });

    // "ignore" not specified in generic argument
    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data>>
    >();
  }

  {
    const result = client.mutate<Data, Variables, ApolloCache, "ignore">({
      mutation,
      errorPolicy: "ignore",
    });

    expectTypeOf(result).toEqualTypeOf<
      Promise<ApolloClient.MutateResult<Data, "ignore">>
    >();
  }

  client.mutate<Data, Variables, ApolloCache, "ignore">(
    // @ts-expect-error missing "errorPolicy" option
    { mutation }
  );

  client.mutate<Data, Variables, ApolloCache, "ignore">({
    mutation,
    // @ts-expect-error "none" not assignable to "ignore"
    errorPolicy: "none",
  });
});

test("does not allow arbitrary errorPolicy", () => {
  // @ts-expect-error "foo" not assignable to errorPolicy
  client.mutate<Data, Variables, ApolloCache, "foo">({ mutation });
  client.mutate<Data, Variables>({
    mutation,
    // @ts-expect-error "foo" not assignable to ErrorPolicy
    errorPolicy: "foo",
  });
  // @ts-expect-error "foo" not assignable to ErrorPolicy
  client.mutate<Data, Variables, ApolloCache, "foo">({
    mutation,
    errorPolicy: "foo",
  });
});
