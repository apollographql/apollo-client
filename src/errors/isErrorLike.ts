import type { ErrorLike } from "@apollo/client";

export function isErrorLike(error: unknown): error is ErrorLike {
  return (
    error !== null &&
    typeof error === "object" &&
    typeof (error as ErrorLike).message === "string" &&
    typeof (error as ErrorLike).name === "string" &&
    (typeof (error as ErrorLike).stack === "string" ||
      typeof (error as ErrorLike).stack === "undefined")
  );
}
