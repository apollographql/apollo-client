export const thresholds: { [name: string]: number } = {
  'constructing an instance': 0.015 / 0.062,

  'fetching a query result from mocked server': 2 / 0.062,

  'write data and receive update from the cache': 2 / 0.062,
  'write data and deliver update to 5 subscribers': 2.6 / 0.062,
  'write data and deliver update to 10 subscribers': 2.9 / 0.062,
  'write data and deliver update to 20 subscribers': 3.8 / 0.062,
  'write data and deliver update to 40 subscribers': 5.2 / 0.062,
  'write data and deliver update to 80 subscribers': 7.9 / 0.062,
  'write data and deliver update to 160 subscribers': 13.5 / 0.062,
  'write data and deliver update to 320 subscribers': 27.2 / 0.062,

  'read single item from cache with 5 items in cache': 0.6 / 0.062,
  'read single item from cache with 10 items in cache': 0.6 / 0.062,
  'read single item from cache with 20 items in cache': 0.6 / 0.062,
  'read single item from cache with 40 items in cache': 0.6 / 0.062,
  'read single item from cache with 80 items in cache': 0.6 / 0.062,
  'read single item from cache with 160 items in cache': 0.6 / 0.062,
  'read single item from cache with 320 items in cache': 1.6 / 0.062,

  'read result with 5 items associated with the result': 0.7 / 0.062,
  'read result with 10 items associated with the result': 0.7 / 0.062,
  'read result with 20 items associated with the result': 0.7 / 0.062,
  'read result with 40 items associated with the result': 1.8 / 0.062,
  'read result with 80 items associated with the result': 1.9 / 0.062,
  'read result with 160 items associated with the result': 1.2 / 0.062,
  'read result with 320 items associated with the result': 1.9 / 0.062,

  'diff query against store with 5 items': 0.06 / 0.062,
  'diff query against store with 10 items': 0.07 / 0.062,
  'diff query against store with 20 items': 0.07 / 0.062,
  'diff query against store with 40 items': 0.08 / 0.062,
  'diff query against store with 80 items': 0.2 / 0.062,
  'diff query against store with 160 items': 0.3 / 0.062,
  'diff query against store with 320 items': 0.6 / 0.062,
};
