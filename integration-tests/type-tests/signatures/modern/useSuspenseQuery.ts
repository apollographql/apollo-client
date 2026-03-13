import { DataValue, gql, TypedDocumentNode } from "@apollo/client";
import { skipToken, useSuspenseQuery } from "@apollo/client/react";
import { DeepPartial } from "@apollo/client/utilities";
import { expectTypeOf } from "expect-type";

declare function test(name: string, test: () => void): void;
declare function it(name: string, test: () => void): void;
declare function useVariablesQueryCase(): {
  query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables>;
};
declare function useMaskedVariablesQueryCase(): {
  query: TypedDocumentNode<MaskedVariablesCaseData, VariablesCaseVariables>;
  unmaskedQuery: TypedDocumentNode<
    MaskedVariablesCaseData,
    VariablesCaseVariables
  >;
};

interface VariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
    name: string;
  };
}

interface VariablesCaseVariables {
  id: string;
}

interface MaskedVariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
  };
}

interface UnmaskedVariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
    name: string;
  };
}

declare const query: TypedDocumentNode<
  VariablesCaseData,
  VariablesCaseVariables
>;
declare const maskedQuery: TypedDocumentNode<
  MaskedVariablesCaseData,
  VariablesCaseVariables
>;
declare const unmaskedQuery: TypedDocumentNode<
  UnmaskedVariablesCaseData,
  VariablesCaseVariables
>;

declare module "@apollo/client" {
  export interface TypeOverrides {
    signatureStyle: "modern";
  }
}
it("returns unknown when TData cannot be inferred", () => {
  const query = gql`
        query {
          hello
        }
      `;

  const { data, dataState } = useSuspenseQuery(query);

  expectTypeOf(data).toEqualTypeOf<unknown>();
  expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();
});

it("disallows wider variables type than specified", () => {
  const { query } = useVariablesQueryCase();

  // @ts-expect-error unknown variable
  useSuspenseQuery(query, {
    variables: {
      id: "1",
      foo: "bar",
    },
  });
});

it("returns TData in default case", () => {
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      variables: { id: "1" },
    });

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

  /*   {
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { variables: { id: "1" } });

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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      variables: { id: "1" },
    });

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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { variables: { id: "1" } });

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
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

  /*   {
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { errorPolicy: "ignore", variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      errorPolicy: "all",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      errorPolicy: "all",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      errorPolicy: "all",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { errorPolicy: "all", variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      errorPolicy: "none",
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      errorPolicy: "none",
      variables: { id: "1" },
    });

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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      errorPolicy: "none",
      variables: { id: "1" },
    });

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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { errorPolicy: "none", variables: { id: "1" } });

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
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      returnPartialData: true,
      variables: { id: "1" },
    });

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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      variables: { id: "1" },
    });

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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      returnPartialData: true,
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | DeepPartial<MaskedVariablesCaseData>
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
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { returnPartialData: true, variables: { id: "1" } });

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
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      returnPartialData: false,
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: false,
      variables: { id: "1" },
    });

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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      returnPartialData: false,
      variables: { id: "1" },
    });

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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { returnPartialData: false, variables: { id: "1" } });

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

it("returns TData | undefined when skip is present", () => {
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      skip: true,
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      skip: true,
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  // TypeScript is too smart and using a `const` or `let` boolean variable
  // for the `skip` option results in a false positive. Using an options
  // object allows us to properly check for a dynamic case.
  const options = {
    skip: true,
  };

  {
    const { data, dataState } = useSuspenseQuery(query, {
      skip: options.skip,
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      skip: true,
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { skip: true, variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

  /*  {
    const options = {
      skip: true,
    };

    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { skip: options.skip, variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

it("returns TData | undefined when using `skipToken` as options", () => {
  const { query } = useVariablesQueryCase();
  const options = {
    skip: true,
  };

  {
    const { data, dataState } = useSuspenseQuery(
      query,
      options.skip ? skipToken : { variables: { id: "1" } }
    );

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, options.skip ? skipToken : { variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(
      maskedQuery,
      options.skip ? skipToken : { variables: { id: "1" } }
    );

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

  /*   {
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, options.skip ? skipToken : { variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

it("returns TData | undefined when using `skipToken` with undefined options", () => {
  const { query } = useVariablesQueryCase();
  const options = {
    skip: true,
  };

  {
    const { data, dataState } = useSuspenseQuery(
      query,
      options.skip ? skipToken : { variables: { id: "1" } }
    );

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, options.skip ? skipToken : { variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(
      maskedQuery,
      options.skip ? skipToken : { variables: { id: "1" } }
    );

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, options.skip ? skipToken : { variables: { id: "1" } });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

it("returns DeepPartial<TData> | undefined when using `skipToken` as options with `returnPartialData`", () => {
  const { query } = useVariablesQueryCase();
  const options = {
    skip: true,
  };

  {
    const { data, dataState } = useSuspenseQuery(
      query,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "1" } }
      )
    );

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
  }

  /* {
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(
      query,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "id" } }
      )
    );

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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(
      maskedQuery,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "1" } }
      )
    );

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
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(
      maskedQuery,
      options.skip ? skipToken : (
        { returnPartialData: true, variables: { id: "1" } }
      )
    );

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
});

it("returns TData when passing an option that does not affect TData", () => {
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      fetchPolicy: "no-cache",
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      fetchPolicy: "no-cache",
      variables: { id: "1" },
    });

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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      fetchPolicy: "no-cache",
      variables: { id: "1" },
    });

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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, { fetchPolicy: "no-cache", variables: { id: "1" } });

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
  // TypeScript is too smart and using a `const` or `let` boolean variable
  // for the `skip` option results in a false positive. Using an options
  // object allows us to properly check for a dynamic case which is the
  // typical usage of this option.
  const options = {
    skip: true,
  };

  const { query } = useVariablesQueryCase();
  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

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
  }

  /*  {
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

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

  {
    const { data, dataState } = useSuspenseQuery(query, {
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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

  /*  {
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      returnPartialData: true,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

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

  {
    const { data, dataState } = useSuspenseQuery(query, {
      skip: options.skip,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      skip: options.skip,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      skip: options.skip,
      errorPolicy: "ignore",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

  {
    const { data, dataState } = useSuspenseQuery(query, {
      skip: options.skip,
      errorPolicy: "none",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      skip: options.skip,
      errorPolicy: "none",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      VariablesCaseData | DataValue.Streaming<VariablesCaseData> | undefined
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

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      skip: options.skip,
      errorPolicy: "none",
      variables: { id: "1" },
    });

    expectTypeOf(data).toEqualTypeOf<
      | MaskedVariablesCaseData
      | DataValue.Streaming<MaskedVariablesCaseData>
      | undefined
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

  {
    const { data, dataState } = useSuspenseQuery(query, {
      skip: options.skip,
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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
  }

  /*   {
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      skip: options.skip,
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      skip: options.skip,
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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
});

it("returns correct TData type when combined options that do not affect TData", () => {
  const { query } = useVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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

  const { query: maskedQuery } = useMaskedVariablesQueryCase();

  {
    const { data, dataState } = useSuspenseQuery(maskedQuery, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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
    const { data, dataState } = useSuspenseQuery<
      MaskedVariablesCaseData,
      VariablesCaseVariables
    >(maskedQuery, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
      variables: { id: "1" },
    });

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

it("uses proper masked types for refetch", async () => {
  const { query, unmaskedQuery } = useMaskedVariablesQueryCase();

  {
    const { refetch } = useSuspenseQuery(query, { variables: { id: "1" } });
    const { data } = await refetch();

    expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData | undefined>();
  }

  {
    const { refetch } = useSuspenseQuery(unmaskedQuery, {
      variables: { id: "1" },
    });
    const { data } = await refetch();

    expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData | undefined>();
  }
});

it("uses proper masked types for fetchMore", async () => {
  const { query, unmaskedQuery } = useMaskedVariablesQueryCase();

  /* {
    const { fetchMore } = useSuspenseQuery(query, {
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
    const { fetchMore } = useSuspenseQuery(unmaskedQuery, {
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
  } */
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

  const { query, unmaskedQuery } = useMaskedVariablesQueryCase();

  /* {
    const { subscribeToMore } = useSuspenseQuery(query, {
      variables: { id: "1" },
    });

    const subscription: TypedDocumentNode<
      Subscription,
      Record<string, never>
    > = gql`
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
      updateQuery: (queryData, { subscriptionData }) => {
        expectTypeOf(queryData).toEqualTypeOf<
          DeepPartial<UnmaskedVariablesCaseData>
        >();

        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();

        return {} as UnmaskedVariablesCaseData;
      },
    });
  } */

  /*  {
    const { subscribeToMore } = useSuspenseQuery(unmaskedQuery, {
      variables: { id: "1" },
    });

    const subscription: TypedDocumentNode<
      Subscription,
      Record<string, never>
    > = gql`
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
        { subscriptionData, complete, previousData }
      ) => {
        expectTypeOf(queryData).toEqualTypeOf<
          DeepPartial<UnmaskedVariablesCaseData>
        >();

        expectTypeOf(complete).toEqualTypeOf<boolean>();
        expectTypeOf(previousData).toEqualTypeOf<
          | UnmaskedVariablesCaseData
          | DeepPartial<UnmaskedVariablesCaseData>
          | undefined
        >();

        if (complete) {
          expectTypeOf(previousData).toEqualTypeOf<UnmaskedVariablesCaseData>();
        } else {
          expectTypeOf(previousData).toEqualTypeOf<
            DeepPartial<UnmaskedVariablesCaseData> | undefined
          >();
        }

        expectTypeOf(
          subscriptionData.data
        ).toEqualTypeOf<UnmaskedSubscription>();

        return {} as UnmaskedVariablesCaseData;
      },
    });
  } */
});

test("variables are optional and can be anything with an DocumentNode", () => {
  const query = gql``;

  useSuspenseQuery(query);
  useSuspenseQuery(query, {});
  useSuspenseQuery(query, { variables: {} });
  useSuspenseQuery(query, { variables: { foo: "bar" } });
  useSuspenseQuery(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useSuspenseQuery(query, skip ? skipToken : undefined);
  useSuspenseQuery(query, skip ? skipToken : {});
  useSuspenseQuery(query, skip ? skipToken : { variables: {} });
  useSuspenseQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
  useSuspenseQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
});

test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
  const query: TypedDocumentNode<{ greeting: string }> = gql``;

  useSuspenseQuery(query);
  useSuspenseQuery(query, {});
  useSuspenseQuery(query, { variables: {} });
  useSuspenseQuery(query, { variables: { foo: "bar" } });
  useSuspenseQuery(query, { variables: { bar: "baz" } });

  let skip!: boolean;
  useSuspenseQuery(query, skip ? skipToken : undefined);
  useSuspenseQuery(query, skip ? skipToken : {});
  useSuspenseQuery(query, skip ? skipToken : { variables: {} });
  useSuspenseQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
  useSuspenseQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
});

test("variables are optional when TVariables are empty", () => {
  const query: TypedDocumentNode<
    { greeting: string },
    Record<string, never>
  > = gql``;

  useSuspenseQuery(query);
  useSuspenseQuery(query, {});
  useSuspenseQuery(query, { variables: {} });
  // @ts-expect-error unknown variables
  useSuspenseQuery(query, {
    variables: {
      foo: "bar",
    },
  });

  let skip!: boolean;
  useSuspenseQuery(query, skip ? skipToken : undefined);
  useSuspenseQuery(query, skip ? skipToken : {});
  useSuspenseQuery(query, skip ? skipToken : { variables: {} });
  useSuspenseQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : { variables: { foo: "bar" } }
  );
});

test("is invalid when TVariables is `never`", () => {
  const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

  // @ts-expect-error
  useSuspenseQuery(query);
  // @ts-expect-error
  useSuspenseQuery(query, {});
  // @ts-expect-error
  useSuspenseQuery(query, {
    variables: {},
  });
  // @ts-expect-error
  useSuspenseQuery(query, {
    variables: undefined,
  });

  // @ts-expect-error
  useSuspenseQuery(query, {
    variables: {
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error
  useSuspenseQuery(query, skip ? skipToken : undefined);
  useSuspenseQuery(
    query,
    // @ts-expect-error
    skip ? skipToken : {}
  );
  useSuspenseQuery(
    query,
    // @ts-expect-error
    skip ? skipToken : { variables: {} }
  );
  useSuspenseQuery(
    query,
    // @ts-expect-error
    skip ? skipToken : { variables: undefined }
  );
  useSuspenseQuery(
    query,
    // @ts-expect-error unknown variables
    skip ? skipToken : { variables: { foo: "bar" } }
  );
});

test("optional variables are optional", () => {
  const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
    gql``;

  useSuspenseQuery(query);
  useSuspenseQuery(query, {});
  useSuspenseQuery(query, { variables: {} });
  useSuspenseQuery(query, { variables: { limit: 10 } });
  // @ts-expect-error unknown variables
  useSuspenseQuery(query, {
    variables: {
      foo: "bar",
    },
  });
  // @ts-expect-error unknown variables
  useSuspenseQuery(query, {
    variables: {
      limit: 10,
      foo: "bar",
    },
  });

  let skip!: boolean;
  useSuspenseQuery(query, skip ? skipToken : undefined);
  useSuspenseQuery(query, skip ? skipToken : {});
  useSuspenseQuery(query, skip ? skipToken : { variables: {} });
  useSuspenseQuery(query, skip ? skipToken : { variables: { limit: 10 } });
  useSuspenseQuery(
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
  useSuspenseQuery(
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
  useSuspenseQuery(query);
  // @ts-expect-error empty variables
  useSuspenseQuery(query, {});
  // @ts-expect-error empty variables
  useSuspenseQuery(query, { variables: {} });
  useSuspenseQuery(query, { variables: { id: "1" } });
  // @ts-expect-error unknown variables
  useSuspenseQuery(query, {
    variables: {
      foo: "bar",
    },
  });
  // @ts-expect-error unknown variables
  useSuspenseQuery(query, {
    variables: {
      id: "1",
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useSuspenseQuery(query, skip ? skipToken : undefined);
  useSuspenseQuery(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useSuspenseQuery(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useSuspenseQuery(query, skip ? skipToken : { variables: { id: "1" } });
  useSuspenseQuery(
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
  useSuspenseQuery(
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
  useSuspenseQuery(query);
  // @ts-expect-error empty variables
  useSuspenseQuery(query, {});
  // @ts-expect-error empty variables
  useSuspenseQuery(query, { variables: {} });
  useSuspenseQuery(query, { variables: { id: "1" } });
  // @ts-expect-error missing required variables
  useSuspenseQuery(query, { variables: { language: "en" } });
  useSuspenseQuery(query, { variables: { id: "1", language: "en" } });

  // @ts-expect-error unknown variables
  useSuspenseQuery(query, {
    variables: {
      id: "1",
      foo: "bar",
    },
  });

  // @ts-expect-error unknown variables
  useSuspenseQuery(query, {
    variables: {
      id: "1",
      language: "en",
      foo: "bar",
    },
  });

  let skip!: boolean;
  // @ts-expect-error missing variables option
  useSuspenseQuery(query, skip ? skipToken : undefined);
  useSuspenseQuery(
    query,
    // @ts-expect-error missing variables option
    skip ? skipToken : {}
  );
  useSuspenseQuery(
    query,
    // @ts-expect-error missing required variables
    skip ? skipToken : { variables: {} }
  );
  useSuspenseQuery(query, skip ? skipToken : { variables: { id: "1" } });
  useSuspenseQuery(
    query,
    skip ? skipToken : { variables: { id: "1", language: "en" } }
  );
  useSuspenseQuery(
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
  useSuspenseQuery(
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
