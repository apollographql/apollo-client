import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
} from "../../../../core";
import { setupSimpleCase } from "../../../../testing/internal";
import {
  InternalQueryReference,
  PreloadedQueryRef,
  QueryRef,
  QueryReference,
} from "../QueryReference";
import React from "react";

test("kicks off request immediately when created", async () => {
  const { query } = setupSimpleCase();
  let fetchCount = 0;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      fetchCount++;
      return Observable.of({ data: { greeting: "Hello" } });
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
    interface Vars {
      bar: string;
    }
    function ComponentWithQueryRefProp<
      TData = unknown,
      TVariables = unknown,
    >({}: { queryRef: QueryRef<TData, TVariables> }) {
      return null;
    }
    function ComponentWithQueryReferenceProp<
      TData = unknown,
      TVariables = unknown,
    >({}: { queryRef: QueryReference<TData> }) {
      return null;
    }
    function ComponentWithPreloadedQueryRefProp<
      TData = unknown,
      TVariables = unknown,
    >({}: { queryRef: PreloadedQueryRef<TData, TVariables> }) {
      return null;
    }

    {
      const withoutTypes: QueryRef = ANY;
      const withData: QueryRef<Data> = ANY;
      const withDataAndVariables: QueryRef<Data, Vars> = ANY;

      <>
        {/* passing queryRef into components that expect queryRef */}
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
        {/* passing queryRef into components that expect queryReference */}
        <>
          <ComponentWithQueryReferenceProp queryRef={withoutTypes} />
          <ComponentWithQueryReferenceProp queryRef={withData} />
          <ComponentWithQueryReferenceProp queryRef={withDataAndVariables} />
          <ComponentWithQueryReferenceProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryReferenceProp<Data> queryRef={withData} />
          <ComponentWithQueryReferenceProp<Data>
            queryRef={withDataAndVariables}
          />
          <ComponentWithQueryReferenceProp<Data, Vars> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryReferenceProp<Data, Vars> queryRef={withData} />
          <ComponentWithQueryReferenceProp<Data, Vars>
            queryRef={withDataAndVariables}
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
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withData}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withDataAndVariables}
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
        </>
      </>;
    }
    {
      const withoutTypes: QueryReference = ANY;
      const withData: QueryReference<Data> = ANY;
      const withDataAndVariables: QueryReference<Data, Vars> = ANY;
      <>
        {/* passing queryReference into components that expect queryRef */}
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
        {/* passing queryReference into components that expect queryReference */}
        <>
          <ComponentWithQueryReferenceProp queryRef={withoutTypes} />
          <ComponentWithQueryReferenceProp queryRef={withData} />
          <ComponentWithQueryReferenceProp queryRef={withDataAndVariables} />
          <ComponentWithQueryReferenceProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryReferenceProp<Data> queryRef={withData} />
          <ComponentWithQueryReferenceProp<Data>
            queryRef={withDataAndVariables}
          />
          <ComponentWithQueryReferenceProp<Data, Vars> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryReferenceProp<Data, Vars> queryRef={withData} />
          <ComponentWithQueryReferenceProp<Data, Vars>
            queryRef={withDataAndVariables}
          />
        </>
        {/* passing queryReference into components that expect preloadedQueryRef */}
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
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withData}
          />
          <ComponentWithPreloadedQueryRefProp<Data> /* @ts-expect-error */
            queryRef={withDataAndVariables}
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
        {/* passing preloadedQueryRef into components that expect queryReference */}
        <>
          <ComponentWithQueryReferenceProp queryRef={withoutTypes} />
          <ComponentWithQueryReferenceProp queryRef={withData} />
          <ComponentWithQueryReferenceProp queryRef={withDataAndVariables} />
          <ComponentWithQueryReferenceProp<Data> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryReferenceProp<Data> queryRef={withData} />
          <ComponentWithQueryReferenceProp<Data>
            queryRef={withDataAndVariables}
          />
          <ComponentWithQueryReferenceProp<Data, Vars> /* @ts-expect-error */
            queryRef={withoutTypes}
          />
          <ComponentWithQueryReferenceProp<Data, Vars> queryRef={withData} />
          <ComponentWithQueryReferenceProp<Data, Vars>
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
