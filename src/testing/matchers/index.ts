import { expect } from "@jest/globals";
import { toHaveRendered } from "./toHaveRendered.js";
import { toHaveRenderedTimes } from "./toHaveRenderedTimes.js";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toRerender, toRenderExactlyTimes } from "./ProfiledComponent.js";

expect.extend({
  toHaveRendered,
  toHaveRenderedTimes,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toRerender,
  toRenderExactlyTimes,
});
