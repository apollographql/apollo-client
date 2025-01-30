import { expect } from "@jest/globals";
import { toMatchDocument } from "./toMatchDocument.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toBeGarbageCollected } from "./toBeGarbageCollected.js";
import { toBeDisposed } from "./toBeDisposed.js";
import { toComplete } from "./toComplete.js";
import { toEmitApolloQueryResult } from "./toEmitApolloQueryResult.js";
import { toEmitAnything } from "./toEmitAnything.js";
import { toEmitError } from "./toEmitError.js";
import { toEmitMatchedValue } from "./toEmitMatchedValue.js";
import { toEmitNext } from "./toEmitNext.js";
import { toEmitValue } from "./toEmitValue.js";
import { toEmitValueStrict } from "./toEmitValueStrict.js";
import { toEqualApolloQueryResult } from "./toEqualApolloQueryResult.js";
import { toEqualFetchResult } from "./toEqualFetchResult.js";
import { toEqualQueryResult } from "./toEqualQueryResult.js";

expect.extend({
  toComplete,
  toEmitApolloQueryResult,
  toEmitAnything,
  toEmitError,
  toEmitMatchedValue,
  toEmitNext,
  toEmitValue,
  toEmitValueStrict,
  toEqualApolloQueryResult,
  toEqualFetchResult,
  toEqualQueryResult,
  toBeDisposed,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toBeGarbageCollected,
});
