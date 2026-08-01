export const ROUTE_SEGMENT_UNAVAILABLE_MESSAGE = "ไม่พบข้อมูลนี้ หรือคุณไม่มีสิทธิ์เข้าถึง";

export function decodeRouteSegmentOnce(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
