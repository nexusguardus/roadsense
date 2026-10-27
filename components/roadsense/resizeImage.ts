import { fitWithin } from "./view";

/**
 * The longest side sent for analysis. At 1280 px SAM 3.1 missed small signs and
 * lights (7 of 8 scenes checked right at 1920 px, 5 of 8 at 1280 px:
 * docs/roadsense/eval-notes.md), so learners' photos get the same 1920 px.
 */
export const MAX_SIDE = 1920;
const JPEG_QUALITY = 0.85;

export class UnreadableImageError extends Error {
  constructor() {
    super("the browser could not read this image");
    this.name = "UnreadableImageError";
  }
}

/** Decodes through an <img>, which applies the EXIF orientation and reads HEIC on Safari. */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UnreadableImageError());
    };
    image.src = url;
  });
}

/**
 * Redraws the photo at most 1920 px on its longer side and saves it as JPEG at
 * 0.85. Re-encoding drops the EXIF data, location included, before it leaves the
 * device; the server strips metadata again on arrival.
 */
export async function resizeImage(file: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(file);
  if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new UnreadableImageError();
  const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new UnreadableImageError();
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), width, height };
}
