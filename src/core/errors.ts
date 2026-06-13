export type ErrorKind = 'API_DOWN' | 'NOT_FOUND' | 'BAD_ARG' | 'PARSE_FAILED';

/**
 * The one error type the CLI/agent surface understands. `kind` lets a consumer
 * tell "no results" (not an error) from "the API is down" from "you passed a bad
 * brand" from "the page shape changed". Every thrown error in core is one of these.
 */
export class ImasError extends Error {
  readonly kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = 'ImasError';
    this.kind = kind;
  }
}

/** Raised by the HTTP layer for a non-2xx response; carries the status code. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}
