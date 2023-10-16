export interface ErrorCodes {
  [key: number]: { file: string; condition?: string; message?: string };
}

export const errorCodes: ErrorCodes = {};
export const devDebug: ErrorCodes = {};
export const devLog: ErrorCodes = {};
export const devWarn: ErrorCodes = {};
export const devError: ErrorCodes = {};
