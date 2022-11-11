import React, { Suspense } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { act } from 'react-dom/test-utils';

import { useFragment_experimental as useFragment } from '../useFragment';
import { useSuspenseQuery_experimental as useSuspenseQuery } from '../useSuspenseQuery';
import { itAsync } from '../../../testing';
import { ApolloProvider } from '../../context';
import {
  ApolloClient,
  gql,
  ApolloLink,
  TypedDocumentNode,
  InMemoryCache,
  Observable,
  Reference,
} from '../../../core';
import { SuspenseCache } from '../../cache';

describe('useBackgroundQuery (in progress - currently using useSuspenseQuery)', () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item @nonreactive {
      text
    }
  `;

  type QueryData = {
    list: Item[];
  };

  itAsync(
    'avoids depending on whole query response',
    async (resolve, reject) => {
      const cache = new InMemoryCache({
        typePolicies: {
          Item: {
            fields: {
              text(existing, { readField }) {
                return existing || `Item #${readField('id')}`;
              }
            },
          },
        },
      });

      const client = new ApolloClient({
        cache,
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              if (operation.operationName === 'ListQueryWithItemFragment') {
                setTimeout(() => {
                  observer.next({
                    data: {
                      list: [
                        { __typename: 'Item', id: 1 },
                        { __typename: 'Item', id: 2 },
                        { __typename: 'Item', id: 5 },
                      ],
                    },
                  });
                  observer.complete();
                }, 10);
              } else {
                observer.error(
                  `unexpected query ${
                    operation.operationName || operation.query
                  }`
                );
              }
            })
        ),
      });

      const listQuery: TypedDocumentNode<QueryData> = gql`
        query ListQueryWithItemFragment {
          list {
            id
            # The inclusion of this fragment is the key difference between this
            # test and the previous one.
            ...ItemFragment @nonreactive
          }
        }
        ${ItemFragment}
      `;

      const renders: string[] = [];

      function List() {
        const { data } = useSuspenseQuery(listQuery);

        renders.push('list');

        return (
          <ol>
            {data.list.map((item) => (
              <Item key={item.id} id={item.id} />
            ))}
          </ol>
        );
      }

      function Item(props: { id: number }) {
        renders.push('item ' + props.id);
        const { complete, data } = useFragment({
          fragment: ItemFragment,
          from: {
            __typename: 'Item',
            id: props.id,
          },
        });
        return <li>{complete ? data!.text : 'incomplete'}</li>;
      }

      const suspenseCache = new SuspenseCache();
      const { getAllByText } = render(
        <ApolloProvider client={client} suspenseCache={suspenseCache}>
          <Suspense fallback={'loading'}>
            <List />
          </Suspense>
        </ApolloProvider>
      );

      function getItemTexts() {
        return getAllByText(/^Item/).map((li) => li.firstChild!.textContent);
      }

      await waitFor(() => {
        // parent component suspends and shows loading fallback
        expect(screen.getByText('loading')).toBeInTheDocument();
      });

      await waitFor(() => {
        // initial list renders
        expect(getItemTexts()).toEqual(['Item #1', 'Item #2', 'Item #5']);
      });

      expect(renders).toEqual(['list', 'item 1', 'item 2', 'item 5']);

      act(() => {
        cache.writeFragment({
          fragment: ItemFragment,
          data: {
            __typename: 'Item',
            id: 2,
            text: 'Item #2 updated',
          },
        });
      });

      await waitFor(() => {
        expect(getItemTexts()).toEqual([
          'Item #1',
          'Item #2 updated',
          'Item #5',
        ]);
      });

      expect(renders).toEqual([
        'list',
        'item 1',
        'item 2',
        'item 5',
        // Only the second item should have re-rendered.
        'item 2',
      ]);

      act(() => {
        cache.modify({
          fields: {
            list(list: Reference[], { readField }) {
              return [
                ...list,
                cache.writeFragment({
                  fragment: ItemFragment,
                  data: {
                    __typename: 'Item',
                    id: 3,
                  },
                })!,
                cache.writeFragment({
                  fragment: ItemFragment,
                  data: {
                    __typename: 'Item',
                    id: 4,
                  },
                })!,
              ].sort(
                (ref1, ref2) =>
                  readField<Item['id']>('id', ref1)! -
                  readField<Item['id']>('id', ref2)!
              );
            },
          },
        });
      });

      await waitFor(() => {
        expect(getItemTexts()).toEqual([
          'Item #1',
          'Item #2 updated',
          'Item #3',
          'Item #4',
          'Item #5',
        ]);
      });

      expect(renders).toEqual([
        'list',
        'item 1',
        'item 2',
        'item 5',
        'item 2',
        // This is what's new:
        'list',
        'item 1',
        'item 2',
        'item 3',
        'item 4',
        'item 5',
      ]);

      act(() => {
        cache.writeFragment({
          fragment: ItemFragment,
          data: {
            __typename: 'Item',
            id: 4,
            text: 'Item #4 updated',
          },
        });
      });

      await waitFor(() => {
        expect(getItemTexts()).toEqual([
          'Item #1',
          'Item #2 updated',
          'Item #3',
          'Item #4 updated',
          'Item #5',
        ]);
      });

      expect(renders).toEqual([
        'list',
        'item 1',
        'item 2',
        'item 5',
        'item 2',
        'list',
        'item 1',
        'item 2',
        'item 3',
        'item 4',
        'item 5',
        // Only the fourth item should have re-rendered.
        'item 4',
      ]);

      expect(cache.extract()).toMatchSnapshot();

      resolve();
    }
  );
});
