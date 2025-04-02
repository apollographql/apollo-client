import { expect } from "@jest/globals";

import { toBeDisposed } from "./toBeDisposed.js";
import { toBeGarbageCollected } from "./toBeGarbageCollected.js";
import { toComplete } from "./toComplete.js";
import { toEmitAnything } from "./toEmitAnything.js";
import { toEmitApolloQueryResult } from "./toEmitApolloQueryResult.js";
import { toEmitError } from "./toEmitError.js";
import { toEmitFetchResult } from "./toEmitFetchResult.js";
import { toEmitMatchedValue } from "./toEmitMatchedValue.js";
import { toEmitNext } from "./toEmitNext.js";
import { toEmitStrictTyped } from "./toEmitStrictTyped.js";
import { toEmitValue } from "./toEmitValue.js";
import { toEmitValueStrict } from "./toEmitValueStrict.js";
import { toEqualApolloQueryResult } from "./toEqualApolloQueryResult.js";
import { toEqualStrictTyped } from "./toEqualStrictTyped.js";
import { toHaveSuspenseCacheEntryUsing } from "./toHaveSuspenseCacheEntryUsing.js";
import { toMatchDocument } from "./toMatchDocument.js";

expect.extend({
  toComplete,
  toEmitApolloQueryResult,
  toEmitAnything,
  toEmitError,
  toEmitFetchResult,
  toEmitMatchedValue,
  toEmitNext,
  toEmitStrictTyped,
  toEmitValue,
  toEmitValueStrict,
  toEqualApolloQueryResult,
  toEqualStrictTyped,
  toBeDisposed,
  toHaveSuspenseCacheEntryUsing,
  toMatchDocument,
  toBeGarbageCollected,
});
