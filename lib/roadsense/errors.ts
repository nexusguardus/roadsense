/** Data from a model, a file or a request that does not have the shape RoadSense needs. */
export class RoadsenseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoadsenseValidationError";
  }
}
