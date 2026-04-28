export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof HttpError &&
    typeof error.statusCode === "number" &&
    typeof error.code === "string"
  );
}
