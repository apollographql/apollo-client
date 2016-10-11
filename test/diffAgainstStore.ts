import { assert } from 'chai';

import {
  diffQueryAgainstStore,
} from '../src/data/readFromStore';

import { writeQueryToStore } from '../src/data/writeToStore';

import {
  getIdField,
} from '../src/data/extensions';

import gql from 'graphql-tag';

describe('diffing queries against the store', () => {
  it('returns nothing when the store is enough', () => {
    const query = gql`
      {
        people_one(id: "1") {
          name
        }
      }
    `;

    const result = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query,
    });

    assert.notOk(diffQueryAgainstStore({
      store,
      query,
    }).isMissing);
  });

  it('caches root queries both under the ID of the node and the query name', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }
    `;

    const result = {
      people_one: {
        __typename: 'Person',
        id: '1',
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query: firstQuery,
      dataIdFromObject: getIdField,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }
    `;

    const { isMissing } = diffQueryAgainstStore({
      store,
      query: secondQuery,
    });

    assert.notOk(isMissing);
    assert.deepEqual(store['1'], result.people_one);
  });

  it('does not swallow errors other than field errors', () => {
    const firstQuery = gql`
      query {
        person {
          powers
        }
      }`;
    const firstResult = {
      person: {
        powers: 'the force',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });
    const unionQuery = gql`
      query {
        ...notARealFragment
      }`;
    assert.throws(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
        variables: null,
        options: {
          returnPartialData: false,
        },
      });
    }, /No fragment/);
  });

  it('does not error on a correct query with union typed fragments', () => {
    const firstQuery = gql`
      query {
        person {
          firstName
          lastName
        }
      }`;
    const firstResult = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });
    const unionQuery = gql`
      query {
        person {
          ... on Author {
            firstName
            lastName
          }

          ... on Jedi {
            powers
          }
        }
      }`;
    assert.doesNotThrow(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
        variables: null,
        options: {
          returnPartialData: false,
        },
      });
    });
  });

  it('does not error on a query with fields missing from all but one named fragment', () => {
    const firstQuery = gql`
      query {
        person {
          firstName
          lastName
        }
      }`;
    const firstResult = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });
    const unionQuery = gql`
      query {
        person {
          ...authorInfo
          ...jediInfo
        }
      }
      fragment authorInfo on Author {
        firstName
      }
      fragment jediInfo on Jedi {
        powers
      }`;
    assert.doesNotThrow(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
        variables: null,
        options: {
          returnPartialData: false,
        },
      });
    });
  });

  it('throws an error on a query with fields missing from named fragments of all types', () => {
    const firstQuery = gql`
      query {
        person {
          firstName
          lastName
        }
      }`;
    const firstResult = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });
    const unionQuery = gql`
      query {
        person {
          ...authorInfo
          ...jediInfo
        }
      }
      fragment authorInfo on Author {
        firstName
        address
      }
      fragment jediInfo on Jedi {
        jedi
      }`;
    assert.throw(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
        variables: null,
        options: {
          returnPartialData: false,
        },
      });
    });
  });

  it('throws an error on a query with fields missing from fragments of all types', () => {
    const firstQuery = gql`
      query {
        person {
          firstName
          lastName
        }
      }`;
    const firstResult = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });

    const unionQuery = gql`
      query {
        person {
          ... on Author {
            firstName
            address
          }

          ... on Jedi {
            powers
          }
        }
      }`;

    assert.throw(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
        variables: null,
        options: {
          returnPartialData: false,
        },
      });
    });
  });

  it('returns available fields if throwOnMissingField is false', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename
          id
          name
        }
      }
    `;

    const firstResult = {
      people_one: {
        __typename: 'Person',
        id: 'lukeId',
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });

    // Variants on a simple query with a missing field.

    const simpleQuery = gql`
      {
        people_one(id: "1") {
          name
          age
        }
      }
    `;

    const inlineFragmentQuery = gql`
      {
        people_one(id: "1") {
          ... on Person {
            name
            age
          }
        }
      }
    `;

    const namedFragmentQuery = gql`
      query {
        people_one(id: "1") {
          ...personInfo
        }
      }
      fragment personInfo on Person {
        name
        age
      }`;

    const simpleDiff = diffQueryAgainstStore({
      store,
      query: simpleQuery,
      variables: null,
    });

    assert.deepEqual(simpleDiff.result, {
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    const inlineDiff = diffQueryAgainstStore({
      store,
      query: inlineFragmentQuery,
      variables: null,
    });

    assert.deepEqual(inlineDiff.result, {
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    const namedDiff = diffQueryAgainstStore({
      store,
      query: namedFragmentQuery,
      variables: null,
    });

    assert.deepEqual(namedDiff.result, {
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    assert.throws(function() {
      diffQueryAgainstStore({
        store,
        query: simpleQuery,
        variables: null,
        options: {
          returnPartialData: false,
        },
      });
    });
  });
});
