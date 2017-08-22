import gql from 'graphql-tag';

import graphql from '../';

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

    expect(result).toEqual({});
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

    expect(result).toEqual({ a: 'something' });
  });
});
