import {
  DataValue,
  gql,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import {
  QueryRef,
  skipToken,
  useBackgroundQuery,
  useReadQuery,
} from "@apollo/client/react";
import { DeepPartial } from "@apollo/client/utilities";
import { expectTypeOf } from "expect-type";
import {
  it,
  test,
  MaskedVariablesCaseData,
  UnmaskedVariablesCaseData,
  VariablesCaseData,
  setupMaskedVariablesCase,
  setupVariablesCase,
  VariablesCaseVariables,
} from "./shared.js";

it("returns unknown when TData cannot be inferred", () => {
  const query = gql`
      query {
        hello
      }
    `;

  const [queryRef] = useBackgroundQuery(query);
  const { data, dataState } = useReadQuery(queryRef);

  expectTypeOf(queryRef).toEqualTypeOf<
    QueryRef<unknown, OperationVariables, "complete" | "streaming">
  >;
  expectTypeOf(data).toEqualTypeOf<unknown>();
  expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();
});

it("disallows wider variables type than specified", () => {
  const { query } = setupVariablesCase();

  // @ts-expect-error unknown variable
  useBackgroundQuery(query, {
    variables: {
      id: "1",
      foo: "bar",
    },
  });
});

it("returns TData in default case", () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, { variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  } */
});

it('returns TData | undefined with errorPolicy: "ignore"', () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      errorPolicy: "ignore",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { errorPolicy: "ignore", variables: { id: "1" } });

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      errorPolicy: "ignore",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | undefined
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { errorPolicy: "ignore", variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | undefined
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */
});

it('returns TData | undefined with errorPolicy: "all"', () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      errorPolicy: "all",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      errorPolicy: "all",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      errorPolicy: "all",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | undefined
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { errorPolicy: "all", variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | undefined
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming" | "empty">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */
});

it('returns TData with errorPolicy: "none"', () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { errorPolicy: "none", variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  } */
});

it("returns DeepPartial<TData> with returnPartialData: true", () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      returnPartialData: true,
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { returnPartialData: true, variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      returnPartialData: true,
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DeepPartial<MaskedVariablesCaseData>
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<MaskedVariablesCaseData>>();
    }
  }

  /*  {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { returnPartialData: true, variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DeepPartial<MaskedVariablesCaseData>
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<MaskedVariablesCaseData>>();
    }
  } */
});

it("returns TData with returnPartialData: false", () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      returnPartialData: false,
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { returnPartialData: false, variables: { id: "1" } });

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      returnPartialData: false,
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { returnPartialData: false, variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  } */
});

it("returns DeepPartial<TData> with returnPartialData: boolean", () => {
  const { query } = setupVariablesCase();

  const options = {
    returnPartialData: true,
    variables: { id: "1" },
  };

  {
    const [queryRef] = useBackgroundQuery(query, options);
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, options);

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  } */
});

it("returns TData with returnPartialData: true and fetchPolicy: no-cache", () => {
  const { query } = setupVariablesCase();

  /*  {
    const [queryRef] = useBackgroundQuery(query, {
      returnPartialData: true,
      fetchPolicy: "no-cache",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      fetchPolicy: "no-cache",
      variables: { id: "1" },
    });

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */
});

it("returns TData when passing an option that does not affect TData", () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "no-cache",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  }

  /*  {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { fetchPolicy: "no-cache", variables: { id: "1" } });

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      fetchPolicy: "no-cache",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { fetchPolicy: "no-cache", variables: { id: "1" } });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  } */
});

it("handles combinations of options", () => {
  const { query } = setupVariablesCase();
  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | undefined
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
      | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DeepPartial<MaskedVariablesCaseData>
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<MaskedVariablesCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial" | "empty"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DeepPartial<MaskedVariablesCaseData>
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial" | "empty"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<MaskedVariablesCaseData>>();
    }

    if (dataState === "empty") {
      expectTypeOf(data).toEqualTypeOf<undefined>();
    }
  } */

  {
    const [queryRef] = useBackgroundQuery(query, {
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | VariablesCaseData
      | DeepPartial<VariablesCaseData>
      | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  } */

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DeepPartial<MaskedVariablesCaseData>
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<MaskedVariablesCaseData>>();
    }
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, {
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming" | "partial"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DeepPartial<MaskedVariablesCaseData>
      | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<
      "complete" | "streaming" | "partial"
    >();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }

    if (dataState === "partial") {
      expectTypeOf(data).toEqualTypeOf<DeepPartial<MaskedVariablesCaseData>>();
    }
  } */
});

it("returns correct TData type when combined options that do not affect TData", () => {
  const { query } = setupVariablesCase();

  /* {
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        VariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<VariablesCaseData>
      >();
    }
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  /* {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  } */

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<
        MaskedVariablesCaseData,
        VariablesCaseVariables,
        "complete" | "streaming"
      >
    >;
    expectTypeOf(data).toEqualTypeOf<
      MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
    >();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

    if (dataState === "complete") {
      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
    }

    if (dataState === "streaming") {
      expectTypeOf(data).toEqualTypeOf<
        DataValue.Streaming<MaskedVariablesCaseData>
      >();
    }
  } */
});

it("returns QueryRef<TData> | undefined when `skip` is present", () => {
  const { query } = setupVariablesCase();
  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, {
      skip: true,
      variables: { id: "1" },
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >;
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { skip: true, variables: { id: "1" } });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  } */

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      skip: true,
      variables: { id: "1" },
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { skip: true, variables: { id: "1" } });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  } */

  // TypeScript is too smart and using a `const` or `let` boolean variable
  // for the `skip` option results in a false positive. Using an options
  // object allows us to properly check for a dynamic case.
  const options = {
    skip: true,
  };

  {
    const [queryRef] = useBackgroundQuery(query, {
      skip: options.skip,
      variables: { id: "1" },
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  }

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, {
      skip: options.skip,
      variables: { id: "1" },
    });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { skip: options.skip, variables: { id: "1" } });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  } */
});

it("returns `undefined` when using `skipToken` unconditionally", () => {
  const { query } = setupVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(query, skipToken);

    expectTypeOf(queryRef).toEqualTypeOf<undefined>();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, skipToken);

    expectTypeOf(queryRef).toEqualTypeOf<undefined>();
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(maskedQuery, skipToken);

    expectTypeOf(queryRef).toEqualTypeOf<undefined>();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, skipToken);

    expectTypeOf(queryRef).toEqualTypeOf<undefined>();
  } */
});

it("returns QueryRef<TData> | undefined when using conditional `skipToken`", () => {
  const { query } = setupVariablesCase();
  const options = {
    skip: true,
  };

  {
    const [queryRef] = useBackgroundQuery(
      query,
      options.skip ? skipToken : { variables: { id: "1" } }
    );

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, options.skip ? skipToken : { variables: { id: "1" } });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(
      maskedQuery,
      options.skip ? skipToken : { variables: { id: "1" } }
    );

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, options.skip ? skipToken : { variables: { id: "1" } });

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      | undefined
    >();
  } */
});

it("returns QueryRef<DeepPartial<TData>> | undefined when using `skipToken` with `returnPartialData`", () => {
  const { query } = setupVariablesCase();
  const options = {
    skip: true,
  };

  {
    const [queryRef] = useBackgroundQuery(
      query,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "1" } }
      )
    );

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      | undefined
    >();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(
      query,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "1" } }
      )
    );

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      | undefined
    >();
  } */

  const { query: maskedQuery } = setupMaskedVariablesCase();

  {
    const [queryRef] = useBackgroundQuery(
      maskedQuery,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "1" } }
      )
    );

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      | undefined
    >();
  }

  /* {
    const [queryRef] = useBackgroundQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(
      maskedQuery,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "1" } }
      )
    );

    expectTypeOf(queryRef).toEqualTypeOf<
      | QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      | undefined
    >();
  } */
});

it("uses proper masked types for refetch", async () => {
  const { query, unmaskedQuery } = setupMaskedVariablesCase();

  {
    const [, { refetch }] = useBackgroundQuery(query, {
      variables: { id: "1" },
    });
    const { data } = await refetch();

    expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData | undefined>();
  }

  {
    const [, { refetch }] = useBackgroundQuery(unmaskedQuery, {
      variables: { id: "1" },
    });
    const { data } = await refetch();

    expectTypeOf(data).toEqualTypeOf<UnmaskedVariablesCaseData | undefined>();
  }
});

it("uses proper masked types for fetchMore", async () => {
  const { query, unmaskedQuery } = setupMaskedVariablesCase();

  {
    const [, { fetchMore }] = useBackgroundQuery(query, {
      variables: { id: "1" },
    });

    const { data } = await fetchMore({
      updateQuery: (queryData, { fetchMoreResult }) => {
        expectTypeOf(queryData).toEqualTypeOf<UnmaskedVariablesCaseData>();

        expectTypeOf(
          fetchMoreResult
        ).toEqualTypeOf<UnmaskedVariablesCaseData>();

        return {} as UnmaskedVariablesCaseData;
      },
    });

    expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData | undefined>();
  }

  {
    const [, { fetchMore }] = useBackgroundQuery(unmaskedQuery, {
      variables: { id: "1" },
    });

    const { data } = await fetchMore({
      updateQuery: (queryData, { fetchMoreResult }) => {
        expectTypeOf(queryData).toEqualTypeOf<UnmaskedVariablesCaseData>();
        expectTypeOf(queryData).not.toEqualTypeOf<MaskedVariablesCaseData>();

        expectTypeOf(
          fetchMoreResult
        ).toEqualTypeOf<UnmaskedVariablesCaseData>();
        expectTypeOf(
          fetchMoreResult
        ).not.toEqualTypeOf<MaskedVariablesCaseData>();

        return {} as UnmaskedVariablesCaseData;
      },
    });

    expectTypeOf(data).toEqualTypeOf<UnmaskedVariablesCaseData | undefined>();
  }
});

it("uses proper masked types for subscribeToMore", async () => {
  type CharacterFragment = {
    __typename: "Character";
    name: string;
  } & { " $fragmentName": "CharacterFragment" };

  type Subscription = {
    pushLetter: {
      __typename: "Character";
      id: number;
    } & { " $fragmentRefs": { CharacterFragment: CharacterFragment } };
  };

  type UnmaskedSubscription = {
    pushLetter: {
      __typename: "Character";
      id: number;
      name: string;
    };
  };

  const { query, unmaskedQuery } = setupMaskedVariablesCase();

  {
    const [, { subscribeToMore }] = useBackgroundQuery(query, {
      variables: { id: "1" },
    });

    const subscription: TypedDocumentNode<Subscription, { letterId: string }> =
      gql`
        subscription LetterPushed($letterId: ID!) {
          pushLetter(letterId: $letterId) {
            id
            ...CharacterFragment
          }
        }

        fragment CharacterFragment on Character {
          name
        }
      `;

    subscribeToMore({
      document: subscription,
      updateQuery: (
        queryData,
        { subscriptionData, variables, complete, previousData }
      ) => {
        expectTypeOf(queryData).toEqualTypeOf<
          DeepPartial<UnmaskedVariablesCaseData>
        >();
        expectTypeOf(queryData).not.toEqualTypeOf<MaskedVariablesCaseData>();
        expectTypeOf(previousData).toEqualTypeOf<
          | UnmaskedVariablesCaseData
          | DeepPartial<UnmaskedVariablesCaseData>
          | undefined
        >();

        if (complete) {
          // Should narrow the type
          expectTypeOf(previousData).toEqualTypeOf<UnmaskedVariablesCaseData>();
          expectTypeOf(
            previousData
          ).not.toEqualTypeOf<MaskedVariablesCaseData>();
        } else {
          expectTypeOf(previousData).toEqualTypeOf<
            DeepPartial<UnmaskedVariablesCaseData> | undefined
          >();
        }

        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();
        expectTypeOf(subscriptionData.data).not.toEqualTypeOf<Subscription>();

        expectTypeOf(variables).toEqualTypeOf<
          VariablesCaseVariables | undefined
        >();

        return {} as UnmaskedVariablesCaseData;
      },
    });
  }

  {
    const [, { subscribeToMore }] = useBackgroundQuery(unmaskedQuery, {
      variables: { id: "1" },
    });

    const subscription: TypedDocumentNode<Subscription, never> = gql`
        subscription {
          pushLetter {
            id
            ...CharacterFragment
          }
        }

        fragment CharacterFragment on Character {
          name
        }
      `;

    subscribeToMore({
      document: subscription,
      updateQuery: (
        queryData,
        { subscriptionData, variables, complete, previousData }
      ) => {
        expectTypeOf(queryData).toEqualTypeOf<
          DeepPartial<UnmaskedVariablesCaseData>
        >();
        expectTypeOf(queryData).not.toEqualTypeOf<MaskedVariablesCaseData>();

        expectTypeOf(previousData).toEqualTypeOf<
          | UnmaskedVariablesCaseData
          | DeepPartial<UnmaskedVariablesCaseData>
          | undefined
        >();

        if (complete) {
          // Should narrow the type
          expectTypeOf(previousData).toEqualTypeOf<UnmaskedVariablesCaseData>();
          expectTypeOf(
            previousData
          ).not.toEqualTypeOf<MaskedVariablesCaseData>();
        } else {
          expectTypeOf(previousData).toEqualTypeOf<
            DeepPartial<UnmaskedVariablesCaseData> | undefined
          >();
        }

        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();
        expectTypeOf(subscriptionData.data).not.toEqualTypeOf<Subscription>();

        expectTypeOf(variables).toEqualTypeOf<
          VariablesCaseVariables | undefined
        >();

        return queryData as UnmaskedVariablesCaseData;
      },
    });
  }
});

test("variables are optional and can be anything with an DocumentNode", () => {
  const query = gql``;

  useBackgroundQuery(query);
  useBackgroundQuery(query, {});
  useBackgroundQuery(query, { variables: {} });
  useBackgroundQuery(query, { variables: { foo: "bar" } });
  useBackgroundQuery(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useBackgroundQuery(query, skip ? skipToken : undefined);
  useBackgroundQuery(query, skip ? skipToken : {});
  useBackgroundQuery(query, skip ? skipToken : { variables: {} });
  useBackgroundQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
  useBackgroundQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
});

test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
  const query: TypedDocumentNode<{ greeting: string }> = gql``;

  useBackgroundQuery(query);
  useBackgroundQuery(query, {});
  useBackgroundQuery(query, { variables: {} });
  useBackgroundQuery(query, { variables: { foo: "bar" } });
  useBackgroundQuery(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useBackgroundQuery(query, skip ? skipToken : undefined);
  useBackgroundQuery(query, skip ? skipToken : {});
  useBackgroundQuery(query, skip ? skipToken : { variables: {} });
  useBackgroundQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
  useBackgroundQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
});

test("variables are optional when TVariables are empty", () => {
  const query: TypedDocumentNode<
    { greeting: string },
    Record<string, never>
  > = gql``;

  useBackgroundQuery(query);
  useBackgroundQuery(query, {});
  useBackgroundQuery(query, { variables: {} });
  // @ts-expect-error unknown variables
  useBackgroundQuery(query, {
    variables: {
      foo: "bar",
    },
  });

  let skip!: boolean;
  useBackgroundQuery(query, skip ? skipToken : undefined);
  useBackgroundQuery(query, skip ? skipToken : {});
  useBackgroundQuery(query, skip ? skipToken : { variables: {} });
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : { variables: { foo: "bar" } }
  );
});

test("is invalid when TVariables is `never`", () => {
  const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

  // @ts-expect-error
  useBackgroundQuery(query);
  // @ts-expect-error
  useBackgroundQuery(query, {});
  // @ts-expect-error
  useBackgroundQuery(query, {
    variables: {},
  });
  // @ts-expect-error
  useBackgroundQuery(query, {
    variables: undefined,
  });
  // @ts-expect-error
  useBackgroundQuery(query, {
    variables: {
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error
  useBackgroundQuery(query, skip ? skipToken : undefined);
  useBackgroundQuery(
    query,
    // @ts-expect-error
    skip ? skipToken : {}
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error
    skip ? skipToken : { variables: {} }
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error
    skip ? skipToken : { variables: undefined }
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : { variables: { foo: "bar" } }
  );
});

test("optional variables are optional", () => {
  const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
    gql``;

  useBackgroundQuery(query);
  useBackgroundQuery(query, {});
  useBackgroundQuery(query, { variables: {} });
  useBackgroundQuery(query, { variables: { limit: 10 } });
  // @ts-expect-error unknown variables
  useBackgroundQuery(query, {
    variables: {
      foo: "bar",
    },
  });
  // @ts-expect-error unknown variables
  useBackgroundQuery(query, {
    variables: {
      limit: 10,
      foo: "bar",
    },
  });

  let skip!: boolean;
  useBackgroundQuery(query, skip ? skipToken : undefined);
  useBackgroundQuery(query, skip ? skipToken : {});
  useBackgroundQuery(query, skip ? skipToken : { variables: {} });
  useBackgroundQuery(query, skip ? skipToken : { variables: { limit: 10 } });
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : (
      {
        variables: {
          foo: "bar",
        },
      }
    )
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : (
      {
        variables: {
          limit: 10,
          foo: "bar",
        },
      }
    )
  );
});

test("enforces required variables when TVariables includes required variables", () => {
  const query: TypedDocumentNode<{ character: string }, { id: string }> = gql``;

  // @ts-expect-error empty variables
  useBackgroundQuery(query);
  // @ts-expect-error empty variables
  useBackgroundQuery(query, {});
  // @ts-expect-error empty variables
  useBackgroundQuery(query, { variables: {} });
  useBackgroundQuery(query, { variables: { id: "1" } });
  // @ts-expect-error unknown variables
  useBackgroundQuery(query, {
    variables: {
      foo: "bar",
    },
  });
  // @ts-expect-error unknown variables
  useBackgroundQuery(query, {
    variables: {
      id: "1",
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useBackgroundQuery(query, skip ? skipToken : undefined);
  useBackgroundQuery(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useBackgroundQuery(query, skip ? skipToken : { variables: { id: "1" } });
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : (
      {
        variables: {
          foo: "bar",
        },
      }
    )
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : (
      {
        variables: {
          id: "1",
          foo: "bar",
        },
      }
    )
  );
});

test("requires variables with mixed TVariables", () => {
  const query: TypedDocumentNode<
    { character: string },
    { id: string; language?: string }
  > = gql``;

  // @ts-expect-error empty variables
  useBackgroundQuery(query);
  // @ts-expect-error empty variables
  useBackgroundQuery(query, {});
  // @ts-expect-error empty variables
  useBackgroundQuery(query, { variables: {} });
  useBackgroundQuery(query, { variables: { id: "1" } });
  // @ts-expect-error missing required variables
  useBackgroundQuery(query, {
    variables: { language: "en" },
  });
  useBackgroundQuery(query, { variables: { id: "1", language: "en" } });
  // @ts-expect-error unknown variables
  useBackgroundQuery(query, {
    variables: {
      id: "1",
      foo: "bar",
    },
  });
  // @ts-expect-error unknown variables
  useBackgroundQuery(query, {
    variables: {
      id: "1",
      language: "en",
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useBackgroundQuery(query, skip ? skipToken : undefined);
  useBackgroundQuery(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useBackgroundQuery(query, skip ? skipToken : { variables: { id: "1" } });
  useBackgroundQuery(
    query,
    skip ? skipToken : { variables: { id: "1", language: "en" } }
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : (
      {
        variables: {
          id: "1",
          foo: "bar",
        },
      }
    )
  );
  useBackgroundQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : (
      {
        variables: {
          id: "1",
          language: "en",
          foo: "bar",
        },
      }
    )
  );
});
