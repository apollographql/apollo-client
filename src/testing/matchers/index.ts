import { expect } from "@jest/globals";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toBeGarbageCollected } from "./toBeGarbageCollected.js";
import { toBeDisposed } from "./toBeDisposed.js";
import { toComplete } from "./toComplete.js";
import { toEmitAnything } from "./toEmitAnything.js";
import { toEmitError } from "./toEmitError.js";
import { toEmitMatchedValue } from "./toEmitMatchedValue.js";
import { toEmitNext } from "./toEmitNext.js";
import { toEmitValue } from "./toEmitValue.js";
import { toEmitValueStrict } from "./toEmitValueStrict.js";
import { toEqualQueryResult } from "./toEqualQueryResult.js";

expect.extend({
  toComplete,
  toEmitAnything,
  toEmitError,
  toEmitMatchedValue,
  toEmitNext,
  toEmitValue,
  toEmitValueStrict,
  toEqualQueryResult,
  toBeDisposed,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toBeGarbageCollected,
});
