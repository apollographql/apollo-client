import graphql, { FragmentMatcher } from '../';
import gql from 'graphql-tag';

describe('fragment matcher', () => {
  it('does basic things', () => {
    const resolver = fieldName => fieldName;

    const query = gql`
      {
        a {
          b
          ...yesFrag
          ...noFrag
          ... on Yes {
            e
          }
          ... on No {
            f
          }
        }
      }

      fragment yesFrag on Yes {
        c
      }

      fragment noFrag on No {
        d
      }
    `;

    const fragmentMatcher: FragmentMatcher = (_, typeCondition) =>
      typeCondition === 'Yes';

    const resultWithMatcher = graphql(resolver, query, '', null, null, {
      fragmentMatcher,
    });

    expect(resultWithMatcher).toEqual({
      a: {
        b: 'b',
        c: 'c',
        e: 'e',
      },
    });

    const resultNoMatcher = graphql(resolver, query, '', null, null);

    expect(resultNoMatcher).toEqual({
      a: {
        b: 'b',
        c: 'c',
        d: 'd',
        e: 'e',
        f: 'f',
      },
    });
  });

  it('can return a promise', async () => {
    const resolver = fieldName => fieldName;

    const query = gql`
      {
        a {
          b
          ...trueFrag
          ...falseFrag
          ... on True {
            e
          }
          ... on False {
            f
          }
        }
      }

      fragment trueFrag on True {
        c
      }

      fragment falseFrag on False {
        d
      }
    `;

    const fragmentMatcher: FragmentMatcher = (_, typeCondition) =>
      Promise.resolve(typeCondition === 'True');

    const resultWithMatcher = await graphql(resolver, query, '', null, null, {
      fragmentMatcher,
    });

    expect(resultWithMatcher).toEqual({
      a: {
        b: 'b',
        c: 'c',
        e: 'e',
      },
    });

    const resultNoMatcher = graphql(resolver, query, '', null, null);

    expect(resultNoMatcher).toEqual({
      a: {
        b: 'b',
        c: 'c',
        d: 'd',
        e: 'e',
        f: 'f',
      },
    });
  });
});
