import React, { ReactElement, Suspense } from 'react';
import { render, screen, waitFor, RenderResult } from "@testing-library/react";

import { ApolloProvider } from "../../context";
import {
  InMemoryCache,
  gql,
  TypedDocumentNode,
  ApolloClient,
  Observable,
  ApolloLink,
} from "../../../core";
import { useSuspenseQuery, UseSuspenseQueryResult } from '../useSuspenseQuery';

function renderWithClient(
  client: ApolloClient<any>,
  element: ReactElement
): RenderResult {
  const { rerender, ...result } = render(
    <ApolloProvider client={client}>{element}</ApolloProvider>
  );

  return {
    ...result,
    rerender: (element: ReactElement) => {
      return rerender(
        <ApolloProvider client={client}>{element}</ApolloProvider>
      );
    }
  }
}

describe('useSuspenseQuery', () => {
  it('is importable and callable', () => {
    expect(typeof useSuspenseQuery).toBe('function');
  })

  it('suspends the component until resolved', async () => {
    interface QueryData {
      greeting: string;
    };

    const query: TypedDocumentNode<QueryData> = gql`
      query UserQuery {
        greeting
      }
    `;

    const link = new ApolloLink(() => {
      return new Observable(observer => {
        setTimeout(() => {
          observer.next({ data: { greeting: 'Hello' } });
          observer.complete();
        }, 10);
      });
    })

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache()
    });

    const results: UseSuspenseQueryResult<QueryData>[] = [];
    let renders = 0;

    function Test() {
      renders++;
      const result = useSuspenseQuery(query);

      results.push(result);

      return <div>{result.data.greeting} suspense</div>;
    }

    renderWithClient(client, (
      <Suspense fallback="loading">
        <Test />
      </Suspense>
    ));

    await waitFor(() => screen.getByText('loading'));
    await waitFor(() => screen.getByText('Hello suspense'));

    expect(renders).toBe(2);
    expect(results).toEqual([
      expect.objectContaining({ data: { greeting: 'Hello' } }),
    ]);
  });
});
