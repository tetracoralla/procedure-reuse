export class ComposeScaffoldError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ComposeScaffoldError";
    this.code = code;
    this.details = details;
  }
}

export function publicError(error) {
  if (error instanceof ComposeScaffoldError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "The compose scaffold could not complete the request.",
  };
}
