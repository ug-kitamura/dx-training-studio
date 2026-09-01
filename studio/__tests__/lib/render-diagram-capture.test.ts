import { describe, expect, it } from "vitest";
import {
  buildSmallWidthWarning,
  computeDeviceScaleFactor,
  MAX_PHYSICAL_LONG_EDGE,
  readPngDimensions,
} from "../../lib/render-diagram-capture.mjs";

describe("computeDeviceScaleFactor", () => {
  it("returns preferred dsf when content fits within max physical edge", () => {
    expect(computeDeviceScaleFactor(900, 400)).toBe(2);
    expect(computeDeviceScaleFactor(768, 600)).toBe(2);
  });

  it("reduces dsf when css long edge would exceed max physical pixels", () => {
    expect(computeDeviceScaleFactor(1400, 800)).toBeCloseTo(
      MAX_PHYSICAL_LONG_EDGE / 1400,
    );
    expect(computeDeviceScaleFactor(900, 3000)).toBeCloseTo(
      MAX_PHYSICAL_LONG_EDGE / 3000,
    );
  });
});

describe("readPngDimensions", () => {
  it("reads IHDR width and height from a minimal PNG buffer", () => {
    const buffer = Buffer.alloc(24);
    buffer.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    buffer.writeUInt32BE(1800, 16);
    buffer.writeUInt32BE(900, 20);
    expect(readPngDimensions(buffer)).toEqual({ width: 1800, height: 900 });
  });

  it("throws on invalid signature", () => {
    expect(() => readPngDimensions(Buffer.from("not-a-png"))).toThrow(
      /invalid PNG/i,
    );
  });
});

describe("buildSmallWidthWarning", () => {
  it("returns warning when css width is below threshold", () => {
    expect(buildSmallWidthWarning(320)).toMatch(/320px/);
  });

  it("returns null for normal widths", () => {
    expect(buildSmallWidthWarning(480)).toBeNull();
    expect(buildSmallWidthWarning(900)).toBeNull();
  });
});
