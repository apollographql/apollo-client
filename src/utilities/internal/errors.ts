import type { ErrorLike } from "@apollo/client";
import { UnconventionalError } from "@apollo/client/errors";

function isErrorLike(error: unknown): error is ErrorLike {
  return (
    error !== null &&
    typeof error === "object" &&
    typeof (error as ErrorLike).message === "string" &&
    typeof (error as ErrorLike).name === "string" &&
    (typeof (error as ErrorLike).stack === "undefined" ||
      typeof (error as ErrorLike).stack === "string")
  );
}

export function maybeWrapError(error: unknown) {
  if (isErrorLike(error)) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error, { cause: error });
  }

  return new UnconventionalError(error);
}
