export * from "./index.js";

import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { setVerbosity } from "ts-invariant";
import { __DEV__ } from "@apollo/client/utilities/globals/environment";

loadDevMessages();
loadErrorMessages();
setVerbosity(__DEV__ ? "log" : "silent");
