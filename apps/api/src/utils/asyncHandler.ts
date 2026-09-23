import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not forward a rejected promise from an async handler to the
 * error middleware on its own — without this, an unexpected error (e.g. a
 * DB hiccup) would hang the request instead of returning the structured
 * 500 from app.ts's error handler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
