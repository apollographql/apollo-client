import React, { Suspense } from 'react';
import { render, screen } from "@testing-library/react";

import {
  gql,
  TypedDocumentNode,
} from "../../../core";
import { MockedProvider } from '../../../testing';
import { useSuspenseQuery, UseSuspenseQueryResult } from '../useSuspenseQuery';

describe('useSuspenseQuery', () => {
  it('is importable and callable', () => {
    expect(typeof useSuspenseQuery).toBe('function');
  })

  it('can suspend a query and return results', async () => {
    interface QueryData {
      greeting: string;
    };

    const query: TypedDocumentNode<QueryData> = gql`
      query UserQuery {
        greeting
      }
    `;

    const results: UseSuspenseQueryResult<QueryData>[] = [];
    let renders = 0;

    function Test() {
      renders++;
      const result = useSuspenseQuery(query);

      results.push(result);

      return <div>{result.data.greeting} suspense</div>;
    }

    render(
      <MockedProvider
        mocks={[
          {
            request: { query },
            result: { data: { greeting: 'Hello' } }
          },
        ]}
      >
        <Suspense fallback="loading">
          <Test />
        </Suspense>
      </MockedProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    const greeting = await screen.findByText('Hello suspense')

    expect(greeting).toBeInTheDocument();
    expect(renders).toBe(2);
    expect(results).toEqual([
      expect.objectContaining({ data: { greeting: 'Hello' } }),
    ]);
  });
});
