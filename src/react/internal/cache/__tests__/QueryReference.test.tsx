import React from "react";
import { of } from "rxjs";

import type { DataState, OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { InternalQueryReference } from "@apollo/client/react/internal";
import { setupSimpleCase } from "@apollo/client/testing/internal";

import type { PreloadedQueryRef, QueryRef } from "../QueryReference.js";

test("kicks off request immediately when created", async () => {
  const { query } = setupSimpleCase();
  let fetchCount = 0;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      fetchCount++;
      return of({ data: { greeting: "Hello" } });
    }),
  });

  const observable = client.watchQuery({ query });

  expect(fetchCount).toBe(0);
  new InternalQueryReference(observable, {});
  expect(fetchCount).toBe(1);
});

test.skip("type tests", () => {
  test("passing as prop", () => {
    const ANY: any = {};

    interface Data {
      foo: string;
    }
    type Vars = {
      bar: string;
    };
    function ComponentWithQueryRefProp<
      TData = unknown,
      TVariables extends OperationVariables = Record<string, unknown>,
      TStates extends
        DataState<TData>["dataState"] = DataState<TData>["dataState"],
    >({}: { queryRef: QueryRef<TData, TVariables, TStates> }) {
      return null;
    }
    function ComponentWithPreloadedQueryRefProp<
      TData = unknown,
      TVariables extends OperationVariables = Record<string, unknown>,
      TStates extends
        DataState<TData>["dataState"] = DataState<TData>["dataState"],
    >({}: { queryRef: PreloadedQueryRef<TData, TVariables, TStates> }) {
      return null;
    }

    {
      const withoutTypes: QueryRef = ANY;
      const withData: QueryRef<Data> = ANY;
      const withDataAndVariables: QueryRef<Data, Vars> = ANY;
      const withDataAndVariablesAndStates: QueryRef<
        Data,
        Vars,
        "complete" | "streaming"
      > = ANY;
      const withDataAndVariablesAndPartialStates: QueryRef<
        Data,
        Vars,
        "complete" | "streaming" | "partial"
      > = ANY;

      <>
        {/* passing queryRef into components that expect queryRef */}
        <>
          <ComponentWithQueryRefProp queryRef={withoutTypes} />
          <ComponentWithQueryRefProp queryRef={withData} />
          <ComponentWithQueryRefProp queryRef={withDataAndVariables} />
          <ComponentWithQueryRefProp queryRef={withDataAndVariablesAndStates} />
          <ComponentWithQueryRefProp
            queryRef={withDataAndVariablesAndPartialStates}
          />

          <ComponentWithQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryRefProp<Data> queryRef={withData} />
          <ComponentWithQueryRefProp<Data> queryRef={withDataAndVariables} />
          <ComponentWithQueryRefProp<Data>
            queryRef={withDataAndVariablesAndStates}
          />
          <ComponentWithQueryRefProp<Data>
            queryRef={withDataAndVariablesAndPartialStates}
          />

          <ComponentWithQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryRefProp<Data, Vars> queryRef={withData} />
          <ComponentWithQueryRefProp<Data, Vars>
            queryRef={withDataAndVariables}
          />
          <ComponentWithQueryRefProp<Data, Vars>
            queryRef={withDataAndVariablesAndStates}
          />
          <ComponentWithQueryRefProp<Data, Vars>
            queryRef={withDataAndVariablesAndPartialStates}
          />

          <ComponentWithQueryRefProp<
            Data,
            Vars,
            "complete" | "streaming"
          > /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryRefProp<Data, Vars, "complete" | "streaming">
            queryRef={withData}
          />
          <ComponentWithQueryRefProp<Data, Vars, "complete" | "streaming">
            queryRef={withDataAndVariables}
          />
          <ComponentWithQueryRefProp<Data, Vars, "complete" | "streaming">
            queryRef={withDataAndVariablesAndStates}
          />
          <ComponentWithQueryRefProp<
            Data,
            Vars,
            "complete" | "streaming"
          > /* @ts-expect-error */
            queryRef={withDataAndVariablesAndPartialStates}
          />
          <ComponentWithQueryRefProp<
            Data,
            Vars,
            "complete" | "streaming" | "partial"
          >
            queryRef={withDataAndVariablesAndStates}
          />
          <ComponentWithQueryRefProp<
            Data,
            Vars,
            "complete" | "streaming" | "partial"
          >
            queryRef={withDataAndVariablesAndPartialStates}
          />
        </>
        {/* passing queryRef into components that expect preloadedQueryRef */}
        <>
          <ComponentWithPreloadedQueryRefProp /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithPreloadedQueryRefProp /* @ts-expect-error */
            queryRef={withData}
          />
          <ComponentWithPreloadedQueryRefProp /* @ts-expect-error */
            queryRef={withDataAndVariables}
          />
          <ComponentWithPreloadedQueryRefProp /* @ts-expect-error */
            queryRef={withDataAndVariablesAndStates}
          />
          <ComponentWithPreloadedQueryRefProp /* @ts-expect-error */
            queryRef={withDataAndVariablesAndPartialStates}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withData}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withDataAndVariables}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withDataAndVariablesAndStates}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withDataAndVariablesAndPartialStates}
          />
          <ComponentWithPreloadedQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithPreloadedQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withData}
          />
          <ComponentWithPreloadedQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withDataAndVariables}
          />
          <ComponentWithPreloadedQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withDataAndVariablesAndStates}
          />
          <ComponentWithPreloadedQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withDataAndVariablesAndPartialStates}
          />
        </>
      </>;
    }
    {
      const withoutTypes: PreloadedQueryRef = ANY;
      const withData: PreloadedQueryRef<Data> = ANY;
      const withDataAndVariables: PreloadedQueryRef<Data, Vars> = ANY;
      <>
        {/* passing preloadedQueryRef into components that expect queryRef */}
        <>
          <ComponentWithQueryRefProp queryRef={withoutTypes} />
          <ComponentWithQueryRefProp queryRef={withData} />
          <ComponentWithQueryRefProp queryRef={withDataAndVariables} />
          <ComponentWithQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryRefProp<Data> queryRef={withData} />
          <ComponentWithQueryRefProp<Data> queryRef={withDataAndVariables} />
          <ComponentWithQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryRefProp<Data, Vars> queryRef={withData} />
          <ComponentWithQueryRefProp<Data, Vars>
            queryRef={withDataAndVariables}
          />
        </>
        {/* passing preloadedQueryRef into components that expect preloadedQueryRef */}
        <>
          <ComponentWithPreloadedQueryRefProp queryRef={withoutTypes} />
          <ComponentWithPreloadedQueryRefProp queryRef={withData} />
          <ComponentWithPreloadedQueryRefProp queryRef={withDataAndVariables} />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithPreloadedQueryRefProp<Data> queryRef={withData} />
          <ComponentWithPreloadedQueryRefProp<Data>
            queryRef={withDataAndVariables}
          />
          <ComponentWithPreloadedQueryRefProp<Data, Vars> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithPreloadedQueryRefProp<Data, Vars> queryRef={withData} />
          <ComponentWithPreloadedQueryRefProp<Data, Vars>
            queryRef={withDataAndVariables}
          />
        </>
      </>;
    }
  });
});
