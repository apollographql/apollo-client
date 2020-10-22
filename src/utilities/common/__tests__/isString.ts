import { isString } from '../isString';

describe('isString', () => {
  it('should identify strings', () => {
    const someString = isString("somestring")
    const notStrings = [{}, [], 0, undefined,null]

    expect(someString).toEqual(true);
    notStrings.forEach(f => expect(isString(f)).toEqual(false));
  });
});
