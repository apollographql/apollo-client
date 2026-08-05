import {
  ApolloClient,
  ErrorLike,
  gql,
  TypedDocumentNode,
} from "@apollo/client";
import { expectTypeOf } from "expect-type";

import { test } from "./shared.js";

declare const client: ApolloClient;

test("fetchMore narrows the result by errorPolicy", async () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, Record<string, never>> = gql``;

  {
    const observable = client.watchQuery({ query });
    const { data, error } = await observable.fetchMore({});

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    // `fetchMore` does not inherit the error policy of the query
    const observable = client.watchQuery({ query, errorPolicy: "all" });
    const { data, error } = await observable.fetchMore({});

    expectTypeOf(data).toEqualTypeOf<Data>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    const observable = client.watchQuery({ query });
    const { data, error } = await observable.fetchMore({ errorPolicy: "all" });

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<ErrorLike | undefined>();
  }

  {
    const observable = client.watchQuery({ query });
    const { data, error } = await observable.fetchMore({
      errorPolicy: "ignore",
    });

    expectTypeOf(data).toEqualTypeOf<Data | undefined>();
    expectTypeOf(error).toEqualTypeOf<undefined>();
  }

  {
    type OtherData = { other: string };
    const otherQuery: TypedDocumentNode<
      OtherData,
      Record<string, never>
    > = gql``;

    const observable = client.watchQuery({ query });
    const { data } = await observable.fetchMore({ query: otherQuery });

    expectTypeOf(data).toEqualTypeOf<OtherData>();
  }
});
