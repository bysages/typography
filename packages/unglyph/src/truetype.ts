import type { FontData, FontMetadata, GlyphData, PathCommand } from "./types";

/**
 * Minimal TrueType writer: compiles unified glyph paths into `glyf` outlines
 * and assembles a version 1.0 sfnt with the standard required tables.
 */

interface Point {
  x: number;
  y: number;
  on: boolean;
}

interface CompiledGlyph {
  contours: Point[][];
  advanceWidth: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

class Writer {
  private buffer = new Uint8Array(2048);
  length = 0;

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.buffer.subarray(0, this.length));
    this.buffer = grown;
  }

  u8(value: number): this {
    this.ensure(1);
    this.buffer[this.length++] = value & 0xff;
    return this;
  }

  u16(value: number): this {
    this.ensure(2);
    this.buffer[this.length++] = (value >> 8) & 0xff;
    this.buffer[this.length++] = value & 0xff;
    return this;
  }

  i16(value: number): this {
    return this.u16(value < 0 ? value + 0x10000 : value);
  }

  u32(value: number): this {
    this.ensure(4);
    this.buffer[this.length++] = (value >>> 24) & 0xff;
    this.buffer[this.length++] = (value >>> 16) & 0xff;
    this.buffer[this.length++] = (value >>> 8) & 0xff;
    this.buffer[this.length++] = value & 0xff;
    return this;
  }

  i32(value: number): this {
    return this.u32(value < 0 ? value + 0x100000000 : value);
  }

  raw(data: Uint8Array): this {
    this.ensure(data.length);
    this.buffer.set(data, this.length);
    this.length += data.length;
    return this;
  }

  utf16(value: string): this {
    for (const char of value) {
      const code = char.codePointAt(0) ?? 0;
      if (code > 0xffff) {
        const offset = code - 0x10000;
        this.u16(0xd800 + (offset >> 10));
        this.u16(0xdc00 + (offset & 0x3ff));
      } else {
        this.u16(code);
      }
    }
    return this;
  }

  pad4(): this {
    while (this.length % 4 !== 0) this.u8(0);
    return this;
  }

  done(): Uint8Array {
    return this.buffer.subarray(0, this.length);
  }
}

/** Split one cubic segment into two quadratic segments (de Casteljau midpoint). */
function cubicToQuads(
  p0: Point,
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p3: { x: number; y: number },
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const mid = {
    x: (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8,
    y: (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8,
  };
  const q1 = { x: p0.x + 0.75 * (c1.x - p0.x), y: p0.y + 0.75 * (c1.y - p0.y) };
  const q2 = { x: p3.x + 0.75 * (c2.x - p3.x), y: p3.y + 0.75 * (c2.y - p3.y) };
  return [q1, mid, q2];
}

function buildContours(commands: PathCommand[], ascent: number): Point[][] {
  const contours: Point[][] = [];
  let current: Point[] | null = null;
  let last: Point | null = null;
  const push = (point: Point) => {
    if (!current) {
      current = [];
      contours.push(current);
    }
    current.push(point);
    last = point;
  };
  for (const command of commands) {
    switch (command.type) {
      case "move":
        current = null;
        push({ x: command.x, y: ascent - command.y, on: true });
        break;
      case "line":
        push({ x: command.x, y: ascent - command.y, on: true });
        break;
      case "quadratic":
        push({ x: command.cx, y: ascent - command.cy, on: false });
        push({ x: command.x, y: ascent - command.y, on: true });
        break;
      case "cubic": {
        if (!last) break;
        const [q1, mid, q2] = cubicToQuads(
          last,
          { x: command.cx1, y: ascent - command.cy1 },
          { x: command.cx2, y: ascent - command.cy2 },
          { x: command.x, y: ascent - command.y },
        );
        push({ ...q1, on: false });
        push({ ...mid, on: true });
        push({ ...q2, on: false });
        push({ x: command.x, y: ascent - command.y, on: true });
        break;
      }
      case "close":
        break;
    }
  }
  return contours.filter((contour) => contour.length >= 3);
}

function compileGlyphs(glyphs: GlyphData[], ascent: number): CompiledGlyph[] {
  return glyphs.map((glyph) => {
    // Unified paths use SVG orientation; glyf coordinates are y-up.
    const contours = buildContours(glyph.path.commands, ascent);
    let xMin = Number.POSITIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const contour of contours) {
      for (const point of contour) {
        if (point.x < xMin) xMin = point.x;
        if (point.y < yMin) yMin = point.y;
        if (point.x > xMax) xMax = point.x;
        if (point.y > yMax) yMax = point.y;
      }
    }
    const empty = contours.length === 0;
    return {
      contours,
      advanceWidth: Math.max(0, Math.round(glyph.advanceWidth)),
      xMin: empty ? 0 : Math.round(xMin),
      yMin: empty ? 0 : Math.round(yMin),
      xMax: empty ? 0 : Math.round(xMax),
      yMax: empty ? 0 : Math.round(yMax),
    };
  });
}

function tableChecksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum =
      (sum +
        ((data[i] << 24) |
          (data[i + 1] << 16) |
          ((data[i + 2] ?? 0) << 8) |
          (data[i + 3] ?? 0))) >>>
      0;
  }
  return sum >>> 0;
}

function buildGlyfLoca(compiled: CompiledGlyph[]): {
  glyf: Uint8Array;
  loca: Uint8Array;
  longLoca: boolean;
} {
  const glyf = new Writer();
  const offsets: number[] = [];
  for (const glyph of compiled) {
    offsets.push(glyf.length);
    if (glyph.contours.length === 0) continue;
    glyf.i16(glyph.contours.length);
    glyf.i16(glyph.xMin);
    glyf.i16(glyph.yMin);
    glyf.i16(glyph.xMax);
    glyf.i16(glyph.yMax);
    let end = -1;
    for (const contour of glyph.contours) {
      end += contour.length;
      glyf.u16(end);
    }
    glyf.u16(0); // instructionLength: no hinting bytecode
    for (const contour of glyph.contours) {
      // Bits 4/5 stay clear so every coordinate is an explicit signed 16-bit delta.
      for (const point of contour) glyf.u8(point.on ? 0x01 : 0x00);
    }
    let previousX = 0;
    for (const contour of glyph.contours) {
      for (const point of contour) {
        glyf.i16(point.x - previousX);
        previousX = point.x;
      }
    }
    let previousY = 0;
    for (const contour of glyph.contours) {
      for (const point of contour) {
        glyf.i16(point.y - previousY);
        previousY = point.y;
      }
    }
    glyf.pad4();
  }
  offsets.push(glyf.length);
  const longLoca = glyf.length > 0x1fffe;
  const loca = new Writer();
  for (const offset of offsets) {
    if (longLoca) loca.u32(offset);
    else loca.u16(offset >> 1);
  }
  return { glyf: glyf.done(), loca: loca.done(), longLoca };
}

function buildHead(
  unitsPerEm: number,
  indexToLocFormat: number,
  macStyle: number,
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
): Uint8Array {
  const head = new Writer();
  head.u32(0x00010000); // version 1.0
  head.u32(0x00010000); // fontRevision 1.0
  head.u32(0); // checkSumAdjustment, patched by buildSfnt
  head.u32(0x5f0f3cf5); // magicNumber
  head.u16(0x0003); // flags
  head.u16(unitsPerEm);
  // LONGDATETIME counts seconds since 1904-01-01.
  const timestamp = Math.max(0, Math.floor((Date.now() - Date.UTC(1904, 0, 1)) / 1000));
  head.u32(0).u32(timestamp); // created
  head.u32(0).u32(timestamp); // modified
  head.i16(xMin);
  head.i16(yMin);
  head.i16(xMax);
  head.i16(yMax);
  head.u16(macStyle);
  head.u16(8); // lowestRecPPEM
  head.i16(2); // fontDirectionHint
  head.i16(indexToLocFormat);
  head.i16(0); // glyphDataFormat
  return head.done();
}

function buildHhea(
  ascent: number,
  descent: number,
  lineGap: number,
  compiled: CompiledGlyph[],
): Uint8Array {
  const advanceMax = compiled.reduce((max, glyph) => Math.max(max, glyph.advanceWidth), 0);
  const minLsb = compiled.reduce(
    (min, glyph) => Math.min(min, glyph.xMin),
    Number.POSITIVE_INFINITY,
  );
  const minRsb = compiled.reduce(
    (min, glyph) => Math.min(min, glyph.advanceWidth - glyph.xMax),
    Number.POSITIVE_INFINITY,
  );
  const extent = compiled.reduce((max, glyph) => Math.max(max, glyph.xMax), 0);
  const hhea = new Writer();
  hhea.u32(0x00010000);
  hhea.i16(ascent);
  hhea.i16(descent);
  hhea.i16(lineGap);
  hhea.u16(advanceMax);
  hhea.i16(minLsb);
  hhea.i16(minRsb);
  hhea.i16(extent);
  hhea.i16(1); // caretSlopeRise
  hhea.i16(0); // caretSlopeRun
  hhea.i16(0); // caretOffset
  hhea.i16(0).i16(0).i16(0).i16(0); // reserved
  hhea.i16(0); // metricDataFormat
  hhea.u16(compiled.length); // numberOfHMetrics
  return hhea.done();
}

function buildHmtx(compiled: CompiledGlyph[]): Uint8Array {
  const hmtx = new Writer();
  for (const glyph of compiled) {
    hmtx.u16(glyph.advanceWidth);
    hmtx.i16(glyph.xMin);
  }
  return hmtx.done();
}

function buildMaxp(compiled: CompiledGlyph[]): Uint8Array {
  let maxPoints = 0;
  let maxContours = 0;
  for (const glyph of compiled) {
    let points = 0;
    for (const contour of glyph.contours) points += contour.length;
    maxPoints = Math.max(maxPoints, points);
    maxContours = Math.max(maxContours, glyph.contours.length);
  }
  const maxp = new Writer();
  maxp.u32(0x00010000);
  maxp.u16(compiled.length);
  maxp.u16(maxPoints);
  maxp.u16(maxContours);
  maxp.u16(0); // maxCompositePoints
  maxp.u16(0); // maxCompositeContours
  maxp.u16(1); // maxZones
  maxp.u16(0); // maxTwilightPoints
  maxp.u16(0); // maxStorage
  maxp.u16(0); // maxFunctionDefs
  maxp.u16(0); // maxInstructionDefs
  maxp.u16(0); // maxStackElements
  maxp.u16(0); // maxSizeOfInstructions
  maxp.u16(0); // maxComponentElements
  maxp.i16(0); // maxComponentDepth
  return maxp.done();
}

interface CodeSegment {
  start: number;
  end: number;
  gid: number;
}

function mergeSegments(codes: Map<number, number>): CodeSegment[] {
  const sorted = [...codes.entries()].sort((a, b) => a[0] - b[0]);
  const segments: CodeSegment[] = [];
  for (const [code, gid] of sorted) {
    const last = segments[segments.length - 1];
    if (last && last.end + 1 === code && last.gid + (code - last.start) === gid) {
      last.end = code;
    } else {
      segments.push({ start: code, end: code, gid });
    }
  }
  return segments;
}

function buildCmapSubtable4(segments: CodeSegment[]): Uint8Array {
  const writer = new Writer();
  const segCount = segments.length + 1;
  const entrySelector = Math.floor(Math.log2(segCount));
  const searchRange = 2 ** entrySelector * 2;
  const length = 16 + segCount * 8;
  writer.u16(4);
  writer.u16(length);
  writer.u16(0); // language
  writer.u16(segCount * 2);
  writer.u16(searchRange);
  writer.u16(entrySelector);
  writer.u16(segCount * 2 - searchRange);
  for (const segment of segments) writer.u16(segment.end);
  writer.u16(0xffff);
  writer.u16(0); // reservedPad
  for (const segment of segments) writer.u16(segment.start);
  writer.u16(0xffff);
  for (const segment of segments) writer.u16((segment.gid - segment.start) & 0xffff);
  writer.u16(1);
  for (let i = 0; i < segCount; i++) writer.u16(0); // idRangeOffset
  return writer.done();
}

function buildCmapSubtable12(segments: CodeSegment[]): Uint8Array {
  const writer = new Writer();
  const length = 16 + segments.length * 12 + 12;
  writer.u16(12);
  writer.u16(0); // reserved
  writer.u32(length);
  writer.u32(0); // language
  writer.u32(segments.length + 1);
  for (const segment of segments) {
    writer.u32(segment.start);
    writer.u32(segment.end);
    writer.u32(segment.gid);
  }
  // Use the Unicode upper bound, not the legacy 32-bit sentinel: OTS rejects
  // values above U+10FFFF, so a 0xFFFFFFFF sentinel makes browser loading fail.
  writer.u32(0x10ffff);
  writer.u32(0x10ffff);
  writer.u32(0);
  return writer.done();
}

function buildCmap(codes: Map<number, number>): Uint8Array {
  const segments = mergeSegments(codes);
  const bmp = segments.filter((segment) => segment.start <= 0xffff);
  const subtable4 = buildCmapSubtable4(
    bmp.length > 0 ? bmp : [{ start: 0xffff, end: 0xffff, gid: 0 }],
  );
  const subtable12 = buildCmapSubtable12(segments);
  const writer = new Writer();
  writer.u16(0); // version
  writer.u16(2); // numTables
  writer
    .u16(3)
    .u16(1)
    .u32(4 + 16); // (3,1) -> format 4
  writer
    .u16(3)
    .u16(10)
    .u32(4 + 16 + subtable4.length); // (3,10) -> format 12
  writer.raw(subtable4);
  writer.raw(subtable12);
  return writer.done();
}

interface NameRecord {
  id: number;
  value: string;
}

function buildName(records: NameRecord[]): Uint8Array {
  // A single Windows/Unicode run is sufficient and avoids duplicate records.
  const storage = new Writer();
  const entries: { id: number; offset: number; length: number }[] = [];
  for (const record of records) {
    if (!record.value) continue;
    const start = storage.length;
    storage.utf16(record.value);
    entries.push({ id: record.id, offset: start, length: storage.length - start });
  }
  const writer = new Writer();
  writer.u16(0); // format
  writer.u16(entries.length);
  writer.u16(6 + entries.length * 12); // stringOffset
  for (const entry of entries) {
    writer.u16(3); // Windows platform
    writer.u16(1); // Unicode BMP
    writer.u16(0x409); // English
    writer.u16(entry.id);
    writer.u16(entry.length);
    writer.u16(entry.offset);
  }
  writer.raw(storage.done());
  return writer.done();
}

function buildOs2(options: {
  weight: number;
  widthClass: number;
  italic: boolean;
  ascent: number;
  descent: number;
  lineGap: number;
  firstChar: number;
  lastChar: number;
  xHeight: number;
  capHeight: number;
}): Uint8Array {
  const fsSelection =
    (options.italic ? 0x0001 : 0) |
    (options.weight >= 700 ? 0x0020 : 0) |
    (!options.italic && options.weight < 700 ? 0x0040 : 0);
  const os2 = new Writer();
  os2.u16(4); // version
  os2.i16(500); // xAvgCharWidth
  os2.u16(options.weight);
  os2.u16(options.widthClass);
  os2.u16(0); // fsType: installable
  os2.i16(650);
  os2.i16(600);
  os2.i16(0);
  os2.i16(75); // subscript
  os2.i16(650);
  os2.i16(600);
  os2.i16(0);
  os2.i16(50); // superscript
  os2.i16(50);
  os2.i16(Math.round(options.ascent / 2)); // strikeout
  os2.i16(0); // sFamilyClass
  for (let i = 0; i < 10; i++) os2.u8(0); // panose
  os2.u32(0).u32(0).u32(0).u32(0); // ulUnicodeRange
  os2.raw(new TextEncoder().encode("BITS")); // achVendID
  os2.u16(fsSelection);
  os2.u16(Math.min(0xffff, options.firstChar));
  os2.u16(Math.min(0xffff, options.lastChar));
  os2.i16(options.ascent);
  os2.i16(options.descent);
  os2.i16(options.lineGap);
  os2.u16(Math.max(0, Math.round(options.ascent)));
  os2.u16(Math.max(0, Math.round(-options.descent)));
  os2.u32(0).u32(0); // ulCodePageRange
  os2.i16(options.xHeight);
  os2.i16(options.capHeight);
  os2.u16(0); // usDefaultChar
  os2.u16(32); // usBreakChar
  os2.u16(1); // usMaxContext
  return os2.done();
}

function buildPost(italicAngle: number): Uint8Array {
  const post = new Writer();
  post.u32(0x00030000); // version 3.0: no glyph names
  post.i32(Math.round(italicAngle * 65536)); // italicAngle (Fixed)
  post.i16(-100); // underlinePosition
  post.i16(50); // underlineThickness
  post.u32(0); // isFixedPitch
  post.u32(0).u32(0).u32(0).u32(0); // min/maxMemType42
  post.u32(0).u32(0).u32(0).u32(0); // min/maxMemType1
  return post.done();
}

function buildSfnt(tables: { tag: string; data: Uint8Array }[]): Uint8Array {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const numTables = sorted.length;
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  const offsets: number[] = [];
  let offset = 12 + numTables * 16;
  for (const table of sorted) {
    offsets.push(offset);
    offset += (table.data.length + 3) & ~3;
  }
  const out = new Writer();
  out.u32(0x00010000); // sfntVersion: TrueType outlines
  out.u16(numTables);
  out.u16(searchRange);
  out.u16(entrySelector);
  out.u16(numTables * 16 - searchRange);
  sorted.forEach((table, index) => {
    out.raw(new TextEncoder().encode(table.tag));
    out.u32(tableChecksum(table.data));
    out.u32(offsets[index]);
    out.u32(table.data.length);
  });
  for (const table of sorted) {
    out.raw(table.data);
    out.pad4();
  }
  const bytes = out.done();
  // checkSumAdjustment over the whole font with the field zeroed.
  const adjustment = (0xb1b0afba - tableChecksum(bytes)) >>> 0;
  const headIndex = sorted.findIndex((table) => table.tag === "head");
  const headOffset = offsets[headIndex];
  bytes[headOffset + 8] = (adjustment >>> 24) & 0xff;
  bytes[headOffset + 9] = (adjustment >>> 16) & 0xff;
  bytes[headOffset + 10] = (adjustment >>> 8) & 0xff;
  bytes[headOffset + 11] = adjustment & 0xff;
  return bytes;
}

export interface TrueTypeOptions {
  familyName: string;
  styleName: string;
  postscriptName: string;
  fullName?: string;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap?: number;
  weight?: number;
  widthClass?: number;
  italic?: boolean;
  metadata?: FontMetadata;
}

/**
 * Compile unified glyph data into a TrueType (glyf outlines) font file.
 */
export function buildTrueTypeFont(fontData: FontData, options: TrueTypeOptions): Uint8Array {
  const compiled = compileGlyphs(fontData.glyphs, options.ascent);
  const { glyf, loca, longLoca } = buildGlyfLoca(compiled);
  const codes = new Map<number, number>();
  fontData.glyphs.forEach((glyph, index) => {
    if (index === 0) return; // .notdef
    const primary =
      typeof glyph.unicode === "string"
        ? (glyph.unicode.codePointAt(0) ?? 0)
        : (glyph.unicode ?? 0);
    if (primary > 0) codes.set(primary, index);
    for (const code of glyph.codePoints ?? []) {
      if (code > 0) codes.set(code, index);
    }
  });

  let xMin = 0;
  let yMin = 0;
  let xMax = 0;
  let yMax = 0;
  for (const glyph of compiled) {
    if (glyph.contours.length === 0) continue;
    xMin = Math.min(xMin, glyph.xMin);
    yMin = Math.min(yMin, glyph.yMin);
    xMax = Math.max(xMax, glyph.xMax);
    yMax = Math.max(yMax, glyph.yMax);
  }

  const metadata: FontMetadata = options.metadata ?? {};
  const version = metadata.version ?? fontData.version ?? "1.0";
  const versionText = version.startsWith("Version ") ? version : `Version ${version}`;
  const fullName = options.fullName ?? `${options.familyName} ${options.styleName}`;
  const ascent = Math.round(options.ascent);
  const descent = Math.round(options.descent);
  const lineGap = Math.round(options.lineGap ?? 0);
  const allCodes = [...codes.keys()];
  const firstChar = allCodes.length > 0 ? Math.min(...allCodes) : 0x20;
  const lastChar = allCodes.length > 0 ? Math.max(...allCodes) : 0xfffd;

  const tables = [
    {
      tag: "OS/2",
      data: buildOs2({
        weight: options.weight ?? 400,
        widthClass: options.widthClass ?? 5,
        italic: options.italic ?? false,
        ascent,
        descent,
        lineGap,
        firstChar,
        lastChar,
        xHeight: Math.round(fontData.xHeight ?? 0),
        capHeight: Math.round(fontData.capHeight ?? 0),
      }),
    },
    { tag: "cmap", data: buildCmap(codes) },
    { tag: "glyf", data: glyf },
    {
      tag: "head",
      data: buildHead(
        options.unitsPerEm,
        longLoca ? 1 : 0,
        (options.italic ? 0x0002 : 0) | ((options.weight ?? 400) >= 700 ? 0x0001 : 0),
        xMin,
        yMin,
        xMax,
        yMax,
      ),
    },
    { tag: "hhea", data: buildHhea(ascent, descent, lineGap, compiled) },
    { tag: "hmtx", data: buildHmtx(compiled) },
    { tag: "loca", data: loca },
    { tag: "maxp", data: buildMaxp(compiled) },
    {
      tag: "name",
      data: buildName([
        { id: 0, value: metadata.copyright ?? "" },
        { id: 1, value: options.familyName },
        { id: 2, value: options.styleName },
        { id: 3, value: `${options.postscriptName};${versionText}` },
        { id: 4, value: fullName },
        { id: 5, value: versionText },
        { id: 6, value: options.postscriptName },
        { id: 7, value: metadata.trademark ?? "" },
        { id: 8, value: metadata.manufacturer ?? "" },
        { id: 9, value: metadata.designer ?? "" },
        { id: 10, value: metadata.description ?? "" },
        { id: 11, value: metadata.manufacturerUrl ?? "" },
        { id: 12, value: metadata.designerUrl ?? "" },
        { id: 13, value: metadata.license ?? "" },
        { id: 14, value: metadata.licenseUrl ?? "" },
      ]),
    },
    { tag: "post", data: buildPost(options.italic ? -12 : 0) },
  ];
  return buildSfnt(tables);
}
