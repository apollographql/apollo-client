import gql from 'graphql-tag';

import { createOperation } from '../../utils/createOperation';
import { selectURI } from '../selectURI';

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

describe('selectURI', () => {
  it('returns a passed in string', () => {
    const uri = '/somewhere';
    const operation = createOperation({ uri }, { query });
    expect(selectURI(operation)).toEqual(uri);
  });

  it('returns a fallback of /graphql', () => {
    const uri = '/graphql';
    const operation = createOperation({}, { query });
    expect(selectURI(operation)).toEqual(uri);
  });

  it('returns the result of a UriFunction', () => {
    const uri = '/somewhere';
    const operation = createOperation({}, { query });
    expect(selectURI(operation, () => uri)).toEqual(uri);
  });
});
