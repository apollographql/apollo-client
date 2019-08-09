export function cloneWithoutTypename<D>(data: D): D {
  return JSON.parse(JSON.stringify(data), function(key, value) {
    return key === '__typename' ? void 0 : value;
  });
}

describe('cloneWithoutTypename', () => {
  it('needs at least one test to be defined', () => {
    expect(
      cloneWithoutTypename({
        a: 1,
        __typename: 'SomeType',
        b: true,
      }),
    ).toEqual({
      a: 1,
      b: true,
    });
  });
});
