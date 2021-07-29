import * as graphql from 'graphql';
import gql from 'graphql-tag';

const queryString = `query SampleQuery {
  stub {
    id
  }
}
`
const query = gql(queryString);

describe('print', () => {

  beforeEach(() => {
    jest.resetModules();
  });

  describe('default', () => {
    beforeEach(() => {
      jest.dontMock('graphql')
    });

    it('removes whitespace', async () => {
      const { print } = await import('../print');
      expect(print(query)).toBe('query SampleQuery{stub{id}}');
    });
  });

  describe('when stripIgnoredCharacters is not defined', () => {
    beforeEach(() => {
      jest.doMock('graphql', () => {
        return {
          ...graphql,
          stripIgnoredCharacters: undefined,
        };
      });
    });

    it('does not remove whitespace', async () => {
      const { print } = await import('../print');
      expect(print(query)).toBe(queryString);
    });
  });
});
