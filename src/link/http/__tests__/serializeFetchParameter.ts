import { serializeFetchParameter } from '../serializeFetchParameter';

describe('serializeFetchParameter', () => {
  it('throws a parse error on an unparsable body', () => {
    const b = {};
    const a = { b };
    (b as any).a = a;

    expect(() => serializeFetchParameter(b, 'Label')).toThrow(/Label/);
  });

  it('returns a correctly parsed body', () => {
    const body = { no: 'thing' };

    expect(serializeFetchParameter(body, 'Label')).toEqual('{"no":"thing"}');
  });
});
