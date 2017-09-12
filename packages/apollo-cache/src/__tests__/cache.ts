import { ApolloCache as Cache } from '../cache';

class TestCache extends Cache {}

describe('abstract cache', () => {
  it('implements readQuery which by default runs the read method', () => {
    const test = new TestCache();
    test.read = jest.fn();

    test.readQuery({});
    expect(test.read).toBeCalled();
  });
});
