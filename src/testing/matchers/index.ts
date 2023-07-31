import { expect } from "@jest/globals";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";

expect.extend({
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
});
