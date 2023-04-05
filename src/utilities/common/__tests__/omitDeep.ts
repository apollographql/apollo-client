import { omitDeep } from '../omitDeep';

test('omits the key from a shallow object', () => {
  expect(omitDeep({ omit: 'a', keep: 'b', other: 'c' }, 'omit')).toEqual({
    keep: 'b',
    other: 'c',
  });
});

test('omits the key from arbitrarily nested object', () => {
  expect(
    omitDeep(
      {
        omit: 'a',
        keep: {
          omit: 'a',
          keep: 'b',
          other: { omit: 'a', keep: 'b', other: 'c' },
        },
      },
      'omit'
    )
  ).toEqual({
    keep: {
      keep: 'b',
      other: { keep: 'b', other: 'c' },
    },
  });
});

test('omits the key from arrays', () => {
  expect(
    omitDeep(
      [
        { omit: 'a', keep: 'b', other: 'c' },
        { omit: 'a', keep: 'b', other: 'c' },
      ],
      'omit'
    )
  ).toEqual([
    { keep: 'b', other: 'c' },
    { keep: 'b', other: 'c' },
  ]);
});

test('omits the key from arbitrarily nested arrays', () => {
  expect(
    omitDeep(
      [
        [{ omit: 'a', keep: 'b', other: 'c' }],
        [
          { omit: 'a', keep: 'b', other: 'c' },
          [{ omit: 'a', keep: 'b', other: 'c' }],
        ],
      ],
      'omit'
    )
  ).toEqual([
    [{ keep: 'b', other: 'c' }],
    [{ keep: 'b', other: 'c' }, [{ keep: 'b', other: 'c' }]],
  ]);
});

test('returns primitives unchanged', () => {
  expect(omitDeep('a', 'ignored')).toBe('a');
  expect(omitDeep(1, 'ignored')).toBe(1);
  expect(omitDeep(true, 'ignored')).toBe(true);
  expect(omitDeep(null, 'ignored')).toBe(null);
  expect(omitDeep(undefined, 'ignored')).toBe(undefined);
  expect(omitDeep(Symbol.for('foo'), 'ignored')).toBe(Symbol.for('foo'));
});
