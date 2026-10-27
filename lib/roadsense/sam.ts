import type { Box, LightFact, MarkingFact, RoadUserFact, SignFact } from "./types";
import { MARKING_KINDS } from "./vocabulary";

// SAM 3.1 answers a concept prompt with text such as
//   <0f>0<|box;x1=1234;y1=337;x2=1383;y2=477;w=1920;h=1280;c=0.92|><|mask;x=0;y=0;c=0.92;data=…|>, 1<|box;…|><|mask;…|>
// (frame 0, then one record per object). Boxes are in pixels of the image as sent;
// masks are kept as raw tokens because the UI only highlights boxes.

export interface SamDetection {
  objectId: number;
  box: { x1: number; y1: number; x2: number; y2: number };
  width: number;
  height: number;
  confidence: number | null;
  maskToken: string;
}

const FRAME_0 = /<0f>([\s\S]*?)(?=<1f>|$)/;
// Box fields are plain key=number pairs, so mask data can never be mistaken for a box.
const RECORD = /(\d+)<\|box;([a-z0-9=.;+-]+)\|>/g;

function fields(raw: string): Map<string, number> {
  return new Map(
    raw.split(";").map((pair) => {
      const [key, value] = pair.split("=");
      return [key, Number(value)] as const;
    }),
  );
}

/** Detections in frame 0. A record without a usable box is left out, so its object simply goes unconfirmed. */
export function parseSamOutput(text: string): SamDetection[] {
  const frame = FRAME_0.exec(text)?.[1] ?? "";
  const records = [...frame.matchAll(RECORD)];
  return records.flatMap((record, i) => {
    const f = fields(record[2]);
    const [x1, y1, x2, y2, width, height] = ["x1", "y1", "x2", "y2", "w", "h"].map((key) => f.get(key) ?? NaN);
    if (![x1, y1, x2, y2, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return [];
    const c = f.get("c");
    const maskEnd = records[i + 1]?.index ?? frame.length;
    return [
      {
        objectId: Number(record[1]),
        box: { x1, y1, x2, y2 },
        width,
        height,
        confidence: c !== undefined && Number.isFinite(c) ? c : null,
        maskToken: frame.slice((record.index ?? 0) + record[0].length, maskEnd).replace(/[,\s]+$/, ""),
      },
    ];
  });
}

/** Pixels to the 0-1000 grid Muse Spark uses. */
export function toGridBox(d: SamDetection): Box {
  return {
    x1: Math.round((d.box.x1 * 1000) / d.width),
    y1: Math.round((d.box.y1 * 1000) / d.height),
    x2: Math.round((d.box.x2 * 1000) / d.width),
    y2: Math.round((d.box.y2 * 1000) / d.height),
  };
}

const area = (b: Box): number => Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);

function intersection(a: Box, b: Box): number {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
}

export function iou(a: Box, b: Box): number {
  const shared = intersection(a, b);
  const union = area(a) + area(b) - shared;
  return union > 0 ? shared / union : 0;
}

/** Intersection over the smaller box's area. Muse Spark's boxes run a little offset, which IoU punishes (Task 1 notes). */
export function overlapOverSmaller(a: Box, b: Box): number {
  const smaller = Math.min(area(a), area(b));
  return smaller > 0 ? intersection(a, b) / smaller : 0;
}

/** Smaller area over larger area: 1 for boxes of the same size, near 0 for a small box against a large one. */
export function areaRatio(a: Box, b: Box): number {
  const larger = Math.max(area(a), area(b));
  return larger > 0 ? Math.min(area(a), area(b)) / larger : 0;
}

const ROAD_USER_CONCEPTS: Record<RoadUserFact["kind"], string> = {
  car: "car",
  motorcycle: "motorcycle",
  bicycle: "bicycle",
  pedestrian: "person",
  // SAM finds nothing for "tram"; "streetcar" finds it.
  tram: "streetcar",
  // SAM finds nothing for "emergency vehicle"; "ambulance" finds ambulances (and, leniently, other emergency vehicles).
  emergency_vehicle: "ambulance",
};

/** The text prompt SAM gets for a fact's kind of object. */
export function samConceptFor(fact: SignFact | LightFact | MarkingFact | RoadUserFact): string {
  if ("state" in fact) return "traffic light";
  if ("position" in fact) return ROAD_USER_CONCEPTS[fact.kind];
  if (!(MARKING_KINDS as readonly string[]).includes(fact.kind)) return "traffic sign";
  if (fact.kind === "zebra_crossing") return "zebra crossing";
  if (fact.kind === "stop_line") return "stop line";
  return "road marking";
}
