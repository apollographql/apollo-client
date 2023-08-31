export type ServerError = Error & {
  response: Response;
  result: Record<string, any> | string;
  statusCode: number;
};

export const throwServerError = (
  response: Response,
  result: any,
  message: string
) => {
  const error = new Error(message) as ServerError;
  error.name = "ServerError";
  error.response = response;
  error.statusCode = response.status;
  error.result = result;
  throw error;
};
