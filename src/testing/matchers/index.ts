import { expect } from "@jest/globals";

import { arrayWithLength } from "./arrayWithLength.js";
import { toBeDisposed } from "./toBeDisposed.js";
import { toBeGarbageCollected } from "./toBeGarbageCollected.js";
import { toComplete } from "./toComplete.js";
import { toEmitAnything } from "./toEmitAnything.js";
import { toEmitError } from "./toEmitError.js";
import { toEmitNext } from "./toEmitNext.js";
import { toEmitTypedValue } from "./toEmitTypedValue.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toMatchDocument } from "./toMatchDocument.js";
import { toStrictEqualTyped } from "./toStrictEqualTyped.js";

expect.extend({
  arrayWithLength,
  toComplete,
  toEmitAnything,
  toEmitError,
  toEmitNext,
  toEmitTypedValue,
  toBeDisposed,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toBeGarbageCollected,
  toStrictEqualTyped,
});
