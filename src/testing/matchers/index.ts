import { expect } from "@jest/globals";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import {
  toHaveRendered,
  toHaveRenderedTimes,
  toRerender,
  toRenderExactlyTimes,
} from "./ProfiledComponent.js";

expect.extend({
  toHaveRendered,
  toHaveRenderedTimes,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toRerender,
  toRenderExactlyTimes,
});
