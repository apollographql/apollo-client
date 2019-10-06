import { validateOperation, } from '../validateOperation';

describe('validateOperation', () => {
  it('should throw when invalid field in operation', () => {
    expect(() => validateOperation(<any>{ qwerty: '' })).toThrow();
  });

  it('should not throw when valid fields in operation', () => {
    expect(() =>
      validateOperation({
        query: '1234',
        context: {},
        variables: {},
      }),
    ).not.toThrow();
  });
});
