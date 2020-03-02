import gql from 'graphql-tag';

import { ApolloCache as Cache } from '../cache';

class TestCache extends Cache {}

describe('abstract cache', () => {
  describe('transformDocument', () => {
    it('returns the document', () => {
      const test = new TestCache();
      expect(test.transformDocument('a')).toBe('a');
    });
  });

  describe('transformForLink', () => {
    it('returns the document', () => {
      const test = new TestCache();
      expect(test.transformForLink('a')).toBe('a');
    });
  });

  describe('readQuery', () => {
    it('runs the read method', () => {
      const test = new TestCache();
      test.read = jest.fn();

      test.readQuery({});
      expect(test.read).toBeCalled();
    });

    it('defaults optimistic to false', () => {
      const test = new TestCache();
      test.read = ({ optimistic }) => optimistic;

      expect(test.readQuery({})).toBe(false);
      expect(test.readQuery({}, true)).toBe(true);
    });
  });

  describe('readFragment', () => {
    it('runs the read method', () => {
      const test = new TestCache();
      test.read = jest.fn();
      const fragment = {
        id: 'frag',
        fragment: gql`
          fragment a on b {
            name
          }
        `,
      };

      test.readFragment(fragment);
      expect(test.read).toBeCalled();
    });

    it('defaults optimistic to false', () => {
      const test = new TestCache();
      test.read = ({ optimistic }) => optimistic;
      const fragment = {
        id: 'frag',
        fragment: gql`
          fragment a on b {
            name
          }
        `,
      };

      expect(test.readFragment(fragment)).toBe(false);
      expect(test.readFragment(fragment, true)).toBe(true);
    });
  });

  describe('writeQuery', () => {
    it('runs the write method', () => {
      const test = new TestCache();
      test.write = jest.fn();

      test.writeQuery({});
      expect(test.write).toBeCalled();
    });
  });

  describe('writeFragment', () => {
    it('runs the write method', () => {
      const test = new TestCache();
      test.write = jest.fn();
      const fragment = {
        id: 'frag',
        fragment: gql`
          fragment a on b {
            name
          }
        `,
      };

      test.writeFragment(fragment);
      expect(test.write).toBeCalled();
    });
  });
});
