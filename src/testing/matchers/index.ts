import { expect } from "@jest/globals";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toRerender, toRenderExactlyTimes } from "./ProfiledComponent.js";

expect.extend({
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toRerender,
  toRenderExactlyTimes,
});
