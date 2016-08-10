import * as chai from 'chai';
const { assert } = chai;

import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient from '../src';

import assign = require('lodash.assign');
import clonedeep = require('lodash.clonedeep');

import gql from 'graphql-tag';

describe('simple type checking on variables', () => {
  function testTypeCheck(typeSig, valuePassed, errorRegexpOrNullIfOK) {
    const query = gql`
      query thing($thing: ${typeSig}) {
        entry(thing: $thing) {
          value
        }
      }
    `;

    const result = {
      data: {
        entry: { value: 1 },
      },
    };

    const variables = {
      thing: valuePassed,
    };
    const networkInterface = mockNetworkInterface({
      request: { query, variables },
      result,
    });

    const client = new ApolloClient({
      networkInterface,
    });

    return client.query({
      query,
      variables,
    })
      .then((res) => {
        if (errorRegexpOrNullIfOK) {
          assert.isNotOk('did not fail', 'expected to fail due to type checking of variables');
        } else {
          assert.isOk('this succeeded as expected');
        }
      } )
      .catch((err) => {
        if (errorRegexpOrNullIfOK) {
          assert.isTrue(errorRegexpOrNullIfOK.test(err.message));
        } else {
          assert.isNotOk('did fail', 'expected to succeed');
        }
      });
  }

  it('type-checking throws on list types', () => testTypeCheck('[Int]', [1, 0, 'string', 3], /must be an Int/));
  it('type-checking throws on non-nullable types', () => testTypeCheck('Int!', null, /non-nullable/));
  it('type-checking does not throw on nullable null', () => testTypeCheck('Int', null, null));
  it('type-checking checks boolean vs number', () => testTypeCheck('Int!', true, /Int/));
  it('type-checking checks integer vs float', () => testTypeCheck('Int!', 3.14, /Int/));
  it('type-checking checks integer vs float', () => testTypeCheck('Float!', 3.14, null));
  it('type-checking checks integer vs float', () => testTypeCheck('Float!', 3, null));
});
