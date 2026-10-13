export class AIConfigurationError extends Error {
  readonly code = "not_configured" as const;
}

export class AIRequestError extends Error {
  readonly code: "timeout" | "rate_limited" | "request_failed";
  constructor(message: string, code: "timeout" | "rate_limited" | "request_failed") {
    super(message);
    this.code = code;
  }
}

export class AIValidationError extends Error {
  readonly code = "invalid_response" as const;
}
