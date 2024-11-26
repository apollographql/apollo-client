import { expect } from "@jest/globals";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toBeGarbageCollected } from "./toBeGarbageCollected.js";
import { toBeDisposed } from "./toBeDisposed.js";
import { toComplete } from "./toComplete.js";
import { toEmitAnything } from "./toEmitAnything.js";
import { toEmitError } from "./toEmitError.js";
import { toEmitNextValue } from "./toEmitNextValue.js";

expect.extend({
  toComplete,
  toEmitAnything,
  toEmitError,
  toEmitNextValue,
  toBeDisposed,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toBeGarbageCollected,
});
