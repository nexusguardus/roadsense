/** Data from a model, a file or a request that does not have the shape RoadSense needs. */
export class RoadsenseValidationError extends Error {
  /** What the rejected model reply was billed, when it came from one: it still counts toward the spend caps. */
  readonly costUsd: number;

  constructor(message: string, costUsd = 0) {
    super(message);
    this.name = "RoadsenseValidationError";
    this.costUsd = costUsd;
  }
}
