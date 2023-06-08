import { expect } from '@jest/globals';
import { toMatchDocument } from './toMatchDocument';

expect.extend({
  toMatchDocument,
});
