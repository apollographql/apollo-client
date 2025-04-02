import { expect } from "@jest/globals";

import { toBeDisposed } from "./toBeDisposed.js";
import { toBeGarbageCollected } from "./toBeGarbageCollected.js";
import { toComplete } from "./toComplete.js";
import { toEmitAnything } from "./toEmitAnything.js";
import { toEmitError } from "./toEmitError.js";
import { toEmitMatchedValue } from "./toEmitMatchedValue.js";
import { toEmitNext } from "./toEmitNext.js";
import { toEmitStrictTyped } from "./toEmitStrictTyped.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toMatchDocument } from "./toMatchDocument.js";
import { toStrictEqualTyped } from "./toStrictEqualTyped.js";

expect.extend({
  toComplete,
  toEmitAnything,
  toEmitError,
  toEmitMatchedValue,
  toEmitNext,
  toEmitStrictTyped,
  toBeDisposed,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toBeGarbageCollected,
  toStrictEqualTyped,
});
