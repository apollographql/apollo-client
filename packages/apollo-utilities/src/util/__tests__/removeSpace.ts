import { removeSpace } from '../removeSpace';

describe('remove space', () => {
  it('will remove unwanted space', () => {
    const str = `The inline argument "something" of kind "something" is not supported.
                    Use variables instead of inline arguments to overcome this limitation.`;

    const expectedStr =
      'The inline argument "something" of kind "something" is not supported.\n' +
      'Use variables instead of inline arguments to overcome this limitation.';

    expect(removeSpace(str)).toEqual(expectedStr);
  });

  it('will remove unwanted space with placeholders', () => {
    const val = {
      first: 'first',
      second: 'second',
    };

    const str = `The inline argument "${val.first}" of kind "${
      val.second
    }" is not supported.
                    Use variables instead of inline arguments to overcome this limitation.`;
    const expectedStr =
      'The inline argument "first" of kind "second" is not supported.\n' +
      'Use variables instead of inline arguments to overcome this limitation.';

    expect(removeSpace(str)).toEqual(expectedStr);
  });
});
