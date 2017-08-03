import { assert } from 'chai';

import graphql from '../src';
import gql from 'graphql-tag';

describe('directives', () => {
  it('skips a field that has the skip directive', () => {
    const resolver = () => {
      throw new Error('should not be called');
    };

    const query = gql`
      {
        a @skip(if: true)
      }
    `;

    const result = graphql(resolver, query);

    assert.deepEqual(result, {});
  });

  it('includes info about arbitrary directives', () => {
    const resolver = (fieldName, root, args, context, info) => {
      const { doSomethingDifferent } = info.directives;
      let data = root[info.resultKey];
      if (doSomethingDifferent) {
        if (doSomethingDifferent.but === 'notTooCrazy') {
          return data;
        }
        return undefined;
      }
      return data;
    };

    const input = {
      a: 'something',
      b: 'hidden',
    };

    const query = gql`
      {
        a @doSomethingDifferent(but: notTooCrazy)
        b @doSomethingDifferent(but: nope)
      }
    `;

    const result = graphql(resolver, query, input);

    assert.deepEqual(result, { a: 'something' });
  });
});
