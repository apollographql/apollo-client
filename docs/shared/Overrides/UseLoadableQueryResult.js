import React from "react";
import { useMDXComponents } from "@mdx-js/react";
import { ManualTuple } from "../ApiDoc";

const HANDLERS = `{
  fetchMore: FetchMoreFunction<TData, TVariables>;
  refetch: RefetchFunction<TData, TVariables>;
  reset: ResetFunction;
}`;

const RETURN_VALUE = `[
  loadQuery: LoadQueryFunction<TVariables>,
  queryRef: QueryRef<TData, TVariables> | null,
  {
    fetchMore: FetchMoreFunction<TData, TVariables>;
    refetch: RefetchFunction<TData, TVariables>;
    reset: ResetFunction;
  }
]`;

export function UseLoadableQueryResult() {
  const MDX = useMDXComponents();

  return (
    <div>
      <MDX.pre>
        <code className="language-ts">{RETURN_VALUE}</code>
      </MDX.pre>
      A tuple of three values:
      <ManualTuple
        idPrefix="useloadablequery-result"
        elements={[
          {
            name: "loadQuery",
            type: "LoadQueryFunction<TVariables>",
            description:
              "A function used to imperatively load a query. Calling this function will create or update the `queryRef` returned by `useLoadableQuery`, which should be passed to `useReadQuery`.",
          },
          {
            name: "queryRef",
            type: "QueryRef<TData, TVariables> | null",
            description:
              "The `queryRef` used by `useReadQuery` to read the query result.",
            canonicalReference: "@apollo/client!QueryRef:interface",
          },
          {
            name: "handlers",
            description:
              "Additional handlers used for the query, such as `refetch`.",
            type: HANDLERS,
          },
        ]}
      />
    </div>
  );
}

UseLoadableQueryResult.propTypes = {};
