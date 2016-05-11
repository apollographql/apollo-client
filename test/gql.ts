import { assert } from 'chai';

import gql from '../src/gql';

describe('gql', () => {
  it('parses queries', () => {
    assert.equal(gql`{ testQuery }`.kind, 'Document');
  });

  it('returns the same object for the same query', () => {
    assert.isTrue(gql`{ sameQuery }` === gql`{ sameQuery }`);
  });
});
