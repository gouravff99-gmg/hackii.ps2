/** An error that is safe to surface to API clients with an explicit status code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code ?? "error";
    this.details = options?.details;
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, message, { code: "bad_request", details });
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message, { code: "unauthorized" });
  }

  static forbidden(message = "You do not have access to this resource") {
    return new ApiError(403, message, { code: "forbidden" });
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message, { code: "not_found" });
  }

  static conflict(message = "Resource is in an incompatible state") {
    return new ApiError(409, message, { code: "conflict" });
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message, { code: "too_many_requests" });
  }
}
