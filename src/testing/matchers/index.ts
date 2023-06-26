import { expect } from '@jest/globals';
import { toMatchDocument } from './toMatchDocument';
import { toHaveSuspenseCacheEntryUsing } from './toHaveSuspenseCacheEntryUsing';

expect.extend({
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
});
