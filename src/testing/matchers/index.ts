import { expect } from "@jest/globals";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toBeGarbageCollected } from "./toBeGarbageCollected.js";
import { toBeDisposed } from "./toBeDisposed.js";
import { toComplete } from "./toComplete.js";
import { toEmitAnything } from "./toEmitAnything.js";
import { toEmitError } from "./toEmitError.js";
import { toEmitValue } from "./toEmitValue.js";
import { toEmitMatchedValue } from "./toEmitMatchedValue.js";
import { toEmitValueStrict } from "./toEmitValueStrict.js";

expect.extend({
  toComplete,
  toEmitAnything,
  toEmitError,
  toEmitMatchedValue,
  toEmitValue,
  toEmitValueStrict,
  toBeDisposed,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toBeGarbageCollected,
});
