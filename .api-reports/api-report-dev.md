## API Report File for "@apollo/client"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

// @public (undocumented)
interface ErrorCodes {
    // (undocumented)
    [key: number]: {
        file: string;
        condition?: string;
        message?: string;
    };
}

// @public
export type ErrorMessageHandler = {
    (message: string | number, args: string[]): string | undefined;
};

// @public (undocumented)
export function loadDevMessages(): void;

// Warning: (ae-forgotten-export) The symbol "ErrorCodes" needs to be exported by the entry point index.d.ts
//
// @public
export function loadErrorMessageHandler(...errorCodes: ErrorCodes[]): ErrorMessageHandler & ErrorCodes;

// @public (undocumented)
export function loadErrorMessages(): void;

// @public
export function setErrorMessageHandler(handler: ErrorMessageHandler): void;

// (No @packageDocumentation comment for this package)

```
