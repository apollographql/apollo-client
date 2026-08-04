import {
  ApolloClient,
  DataValue,
  gql,
  InMemoryCache,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import {
  createQueryPreloader,
  PreloadedQueryRef,
  useReadQuery,
} from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { DeepPartial } from "@apollo/client/utilities";
import { expectTypeOf } from "expect-type";

import { SimpleCaseData, test } from "./shared.js";

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: new MockLink([]),
});
const preloadQuery = createQueryPreloader(client);

test("variables are optional and can be anything with untyped DocumentNode", () => {
  const query = gql``;

  preloadQuery(query);
  preloadQuery(query, { variables: {} });
  preloadQuery(query, { returnPartialData: true, variables: {} });
  preloadQuery(query, { variables: { foo: "bar" } });
  preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
});

test("variables are optional and can be anything with unspecified TVariables", () => {
  type Data = { greeting: string };
  const query: TypedDocumentNode<Data> = gql``;

  preloadQuery(query);
  /* preloadQuery<Data>(query); */
  preloadQuery(query, { variables: {} });
  /* preloadQuery<Data>(query, { variables: {} }); */
  preloadQuery(query, { returnPartialData: true, variables: {} });
  /* preloadQuery<Data>(query, { returnPartialData: true, variables: {} }); */
  preloadQuery(query, { variables: { foo: "bar" } });
  /* preloadQuery<Data>(query, { variables: { foo: "bar" } }); */
  preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
  /* preloadQuery<Data>(query, { variables: { foo: "bar", bar: 2 } }); */
});

test("variables are optional when TVariables are empty", () => {
  type Data = { greeting: string };
  type Variables = Record<string, never>;
  const query: TypedDocumentNode<Data, Variables> = gql``;

  preloadQuery(query);
  /* preloadQuery<Data, Variables>(query); */
  preloadQuery(query, { variables: {} });
  /* preloadQuery<Data, Variables>(query, { variables: {} }); */
  preloadQuery(query, { returnPartialData: true, variables: {} });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {},
  }); */
  preloadQuery(query, {
    variables: {
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variables
      foo: "bar",
    },
  }); */
});

test("is invalid when TVariables is `never`", () => {
  type Data = { greeting: string };
  const query: TypedDocumentNode<Data, never> = gql``;

  // @ts-expect-error
  preloadQuery(query);
  /* // @ts-expect-error
  preloadQuery<Data, never>(query); */
  preloadQuery(query, {
    // @ts-expect-error
    variables: {},
  });
  /* preloadQuery<Data, never>(query, {
    // @ts-expect-error
    variables: {},
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    // @ts-expect-error
    variables: {},
  });
  /* preloadQuery<Data, never>(query, {
    returnPartialData: true,
    // @ts-expect-error
    variables: {},
  }); */
  preloadQuery(query, {
    // @ts-expect-error no variables allowed
    variables: { foo: "bar" },
  });
  /* preloadQuery<Data, never>(query, {
    // @ts-expect-error no variables allowed
    variables: { foo: "bar" },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    // @ts-expect-error no variables allowed
    variables: {
      foo: "bar",
    },
  });
  /* preloadQuery<Data, never>(query, {
    returnPartialData: true,
    // @ts-expect-error no variables allowed
    variables: {
      foo: "bar",
    },
  }); */
});

test("optional variables are optional", () => {
  type Data = { posts: string[] };
  type Variables = { limit?: number };
  const query: TypedDocumentNode<Data, Variables> = gql``;

  preloadQuery(query);
  /* preloadQuery<Data, Variables>(query); */
  preloadQuery(query, { variables: {} });
  /* preloadQuery<Data, Variables>(query, { variables: {} }); */
  preloadQuery(query, { returnPartialData: true, variables: {} });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {},
  }); */
  preloadQuery(query, { variables: { limit: 10 } });
  /* preloadQuery<Data, Variables>(query, { variables: { limit: 10 } }); */
  preloadQuery(query, { returnPartialData: true, variables: { limit: 10 } });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: { limit: 10 },
  }); */
  preloadQuery(query, {
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    variables: {
      limit: 10,
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      limit: 10,
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      limit: 10,
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {
      limit: 10,
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
});

test("enforces required variables", () => {
  type Data = { character: string };
  type Variables = { id: string };
  const query: TypedDocumentNode<Data, Variables> = gql``;

  // @ts-expect-error missing variables option
  preloadQuery(query);
  /* // @ts-expect-error missing variables option
  preloadQuery<Data, Variables>(query); */
  // @ts-expect-error missing variables option
  preloadQuery(query, { returnPartialData: true });
  /* // @ts-expect-error missing variables option
  preloadQuery<Data, Variables>(query, { returnPartialData: true }); */
  preloadQuery(query, {
    // @ts-expect-error empty variables
    variables: {},
  });
  /* preloadQuery<Data, Variables>(query, {
    // @ts-expect-error empty variables
    variables: {},
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    // @ts-expect-error empty variables
    variables: {},
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    // @ts-expect-error empty variables
    variables: {},
  }); */
  preloadQuery(query, { variables: { id: "1" } });
  /* preloadQuery<Data, Variables>(query, { variables: { id: "1" } }); */
  preloadQuery(query, { returnPartialData: true, variables: { id: "1" } });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: { id: "1" },
  }); */
  preloadQuery(query, {
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
});

test("requires variables with mixed TVariables", () => {
  type Data = { character: string };
  type Variables = { id: string; language?: string };
  const query: TypedDocumentNode<Data, Variables> = gql``;

  // @ts-expect-error missing variables argument
  preloadQuery(query);
  /* // @ts-expect-error missing variables argument
  preloadQuery<Data, Variables>(query); */
  // @ts-expect-error missing variables argument
  preloadQuery(query, {});
  /* // @ts-expect-error missing variables argument
  preloadQuery<Data, Variables>(query, {}); */
  // @ts-expect-error missing variables option
  preloadQuery(query, { returnPartialData: true });
  /* // @ts-expect-error missing variables option
  preloadQuery<Data, Variables>(query, { returnPartialData: true }); */
  preloadQuery(query, {
    // @ts-expect-error missing required variables
    variables: {},
  });
  /* preloadQuery<Data, Variables>(query, {
    // @ts-expect-error missing required variables
    variables: {},
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    // @ts-expect-error missing required variables
    variables: {},
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    // @ts-expect-error missing required variables
    variables: {},
  }); */
  preloadQuery(query, { variables: { id: "1" } });
  /* preloadQuery<Data, Variables>(query, { variables: { id: "1" } }); */
  preloadQuery(query, {
    // @ts-expect-error missing required variable
    variables: { language: "en" },
  });
  /* preloadQuery<Data, Variables>(query, {
    // @ts-expect-error missing required variable
    variables: { language: "en" },
  }); */
  preloadQuery(query, { variables: { id: "1", language: "en" } });
  /* preloadQuery<Data, Variables>(query, {
    variables: { id: "1", language: "en" },
  }); */
  preloadQuery(query, {
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    returnPartialData: true,
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    returnPartialData: true,
    variables: {
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
  preloadQuery(query, {
    variables: {
      id: "1",
      language: "en",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  });
  /* preloadQuery<Data, Variables>(query, {
    variables: {
      id: "1",
      language: "en",
      // @ts-expect-error unknown variable
      foo: "bar",
    },
  }); */
});

test("returns QueryReference<unknown> when TData cannot be inferred", () => {
  const query = gql``;

  const queryRef = preloadQuery(query);
  const { data, dataState } = useReadQuery(queryRef);

  expectTypeOf(queryRef).toEqualTypeOf<
    PreloadedQueryRef<unknown, OperationVariables, "complete" | "streaming">
  >();
  expectTypeOf(data).toEqualTypeOf<unknown>();
  expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();
});

test("returns QueryReference<TData> in default case", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query);
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query);
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        OperationVariables,
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  } */
});

test("returns QueryReference<TData | undefined> with errorPolicy: 'ignore'", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, { errorPolicy: "ignore" });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "empty"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      errorPolicy: "ignore",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "empty"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */
});

test("returns QueryReference<TData | undefined> with errorPolicy: 'all'", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, { errorPolicy: "all" });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "empty"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      errorPolicy: "all",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "empty"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData> | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */
});

test("returns QueryReference<TData> with errorPolicy: 'none'", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, { errorPolicy: "none" });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      errorPolicy: "none",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  } */
});

test("returns PreloadedQueryRef with partial dataState with returnPartialData: true", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, { returnPartialData: true });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      returnPartialData: true,
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }
  } */
});

test("returns QueryReference<DeepPartial<TData>> with returnPartialData: false", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, { returnPartialData: false });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      returnPartialData: false,
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  } */
});

test("returns QueryReference<TData> when passing an option unrelated to TData", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, { fetchPolicy: "cache-first" });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      fetchPolicy: "cache-first",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      SimpleCaseData | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }
  } */
});

test("handles combinations of options", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial" | "empty"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
      | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial" | "empty"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
      | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */

  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, {
      returnPartialData: true,
      errorPolicy: "none",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      returnPartialData: true,
      errorPolicy: "none",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }
  } */
});

test("returns correct TData type when combined with options unrelated to TData", () => {
  {
    const query: TypedDocumentNode<SimpleCaseData> = gql``;
    const queryRef = preloadQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
      errorPolicy: "none",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }
  }

  /* {
    const query = gql``;
    const queryRef = preloadQuery<SimpleCaseData>(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
      errorPolicy: "none",
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        SimpleCaseData,
        { [key: string]: any },
        "complete" | "streaming" | "partial"
      >
    >();
    expectTypeOf(data).toEqualTypeOf<
      | SimpleCaseData
      | DeepPartial<SimpleCaseData>
      | DataValue.Streaming<SimpleCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<SimpleCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<DataValue.Streaming<SimpleCaseData>>();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<SimpleCaseData>>();
    }
  } */
});

test("rejects unknown options", () => {
  type Data = { character: string };
  const literalVariables: TypedDocumentNode<Data, { type: "main" }> = gql``;
  const widenedVariables: TypedDocumentNode<Data, { type: string }> = gql``;
  const noVariables: TypedDocumentNode<Data, Record<string, never>> = gql``;

  preloadQuery(literalVariables, {
    variables: { type: "main" },
    returnPartialData: true,
    errorPolicy: "all",
    context: { foo: 1 },
    fetchPolicy: "cache-first",
  });

  preloadQuery(literalVariables, {
    variables: { type: "main" },
    // @ts-expect-error unknown option
    returnPartialDta: false,
  });

  preloadQuery(widenedVariables, {
    variables: { type: "main" },
    // @ts-expect-error unknown option
    returnPartialDta: false,
  });

  preloadQuery(noVariables, {
    // @ts-expect-error unknown option
    returnPartialDta: false,
  });

  preloadQuery(literalVariables, {
    variables: { type: "main" },
    returnPartialData: true,
    // @ts-expect-error unknown option
    bogusOption: 1,
  });
});

test("rejects a known option with an invalid value", () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, { id: string }> = gql``;

  preloadQuery(query, { variables: { id: "1" }, fetchPolicy: "cache-first" });
  // @ts-expect-error invalid fetchPolicy
  preloadQuery(query, { variables: { id: "1" }, fetchPolicy: "bogus" });
  // @ts-expect-error invalid errorPolicy
  preloadQuery(query, { variables: { id: "1" }, errorPolicy: "bogus" });
});

test("rejects invalid variable values for constant variable types", () => {
  type Data = { character: string };
  const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

  preloadQuery(query, { variables: { type: "main" } });
  // @ts-expect-error invalid variable value
  preloadQuery(query, { variables: { type: "nope" } });
  // @ts-expect-error unknown variable
  preloadQuery(query, { variables: { type: "main", foo: "bar" } });
});

test("constant variable types do not widen returnPartialData or errorPolicy", () => {
  type Data = { character: string };

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const queryRef = preloadQuery(query, { variables: { type: "main" } });

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<Data, { type: "main" }, "complete" | "streaming">
    >();

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(data).toEqualTypeOf<
      DataValue.Complete<Data> | DataValue.Streaming<Data>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();
  }

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const queryRef = preloadQuery(query, {
      variables: { type: "main" },
      returnPartialData: false,
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<Data, { type: "main" }, "complete" | "streaming">
    >();
  }

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const queryRef = preloadQuery(query, {
      variables: { type: "main" },
      returnPartialData: true,
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        Data,
        { type: "main" },
        "complete" | "streaming" | "partial"
      >
    >();
  }

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const queryRef = preloadQuery(query, {
      variables: { type: "main" },
      errorPolicy: "none",
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<Data, { type: "main" }, "complete" | "streaming">
    >();
  }

  {
    const query: TypedDocumentNode<Data, { type: "main" }> = gql``;

    const queryRef = preloadQuery(query, {
      variables: { type: "main" },
      errorPolicy: "all",
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<
        Data,
        { type: "main" },
        "complete" | "streaming" | "empty"
      >
    >();
  }

  {
    const query: TypedDocumentNode<Data, { episode: 10 }> = gql``;

    const queryRef = preloadQuery(query, {
      variables: { episode: 10 },
      returnPartialData: false,
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<Data, { episode: 10 }, "complete" | "streaming">
    >();
  }

  {
    const query: TypedDocumentNode<Data, { main: true }> = gql``;

    const queryRef = preloadQuery(query, {
      variables: { main: true },
      returnPartialData: false,
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<Data, { main: true }, "complete" | "streaming">
    >();
  }
});

test("passes through generic variables", () => {
  function wrapper<TData, TVariables extends OperationVariables>(
    query: TypedDocumentNode<TData, TVariables>,
    variables: TVariables
  ) {
    return preloadQuery(query, { variables });
  }

  const query: TypedDocumentNode<{ character: string }, { id: string }> = gql``;

  wrapper(query, { id: "1" });
});
