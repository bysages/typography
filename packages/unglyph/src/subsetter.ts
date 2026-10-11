/**
 * Font subsetting powered by the harfbuzz WASM build from harfbuzzjs.
 *
 * The hb-subset binding, WOFF1 container conversion, and format sniffing are
 * implemented here with plain Uint8Array so the module runs in Node and in
 * browsers without Node polyfills. The subset routine follows subset-font
 * (BSD-3-Clause, (c) 2020 Munter) with the Buffer/fs parts replaced.
 */

import initHarfbuzzWasm from "harfbuzzjs/dist/harfbuzz-subset.wasm?init";
import { toUint8Array } from "undio";
import { compress as compressWoff2, decompress as decompressWoff2 } from "woff2-encoder";

import type { FontInput } from "./types";

export type SubsetTargetFormat = "sfnt" | "truetype" | "woff" | "woff2";

export interface SubsetVariationAxis {
  min: number;
  max: number;
  default?: number;
}

export interface SubsetOptions {
  /** Output container. Defaults to the input format. */
  targetFormat?: SubsetTargetFormat;
  /** Preserve these name table IDs. Pass [] to keep the default set. */
  preserveNameIds?: number[];
  /** Partially or fully instance variable axes: pinned numbers or ranges. */
  variationAxes?: Record<string, number | SubsetVariationAxis>;
  /** Keep only these four-character OpenType feature tags. Defaults to all. */
  keepFeatures?: string[];
  /** Drop these four-character tables from the output. */
  dropTables?: string[];
  /** Keep glyph names in the post table. */
  glyphNames?: boolean;
  /** Strip hinting instructions. */
  noHinting?: boolean;
  /** Disable layout feature closure (smaller output, fewer shaping results). */
  noLayoutClosure?: boolean;
  /** Report subset progress (0..1). Supported at runtime, missing from @types. */
  progressFunction?: (progress: number) => void;
  /** Keep every glyph (like --gids=*) instead of subsetting to `text`. */
  keepAllGlyphs?: boolean;
}

const FOURCC = { ttc: 0x74746366, woff: 0x774f4646, woff2: 0x774f4632 };

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function writeTag(bytes: Uint8Array, offset: number, tag: string): void {
  for (let i = 0; i < 4; i++) bytes[offset + i] = tag.charCodeAt(i);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
  );
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value >>> 24;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

/** Sniff the container format from the leading four bytes. */
export function detectFontFormat(bytes: Uint8Array): "sfnt" | "collection" | "woff" | "woff2" {
  const signature = readU32(bytes, 0);
  if (signature === FOURCC.ttc) return "collection";
  if (signature === FOURCC.woff) return "woff";
  if (signature === FOURCC.woff2) return "woff2";
  if (
    signature === 0x00010000 ||
    signature === 0x74727565 /* true */ ||
    signature === 0x4f54544f /* OTTO */
  ) {
    return "sfnt";
  }
  throw new Error(`Unrecognized font signature: ${readTag(bytes, 0)}`);
}
// Node 18+ and modern browsers ship Compression Streams; "deflate" is the
// zlib-framed variant that WOFF1 table records use.
async function zlibCompress(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zlibDecompress(wrapped: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([wrapped as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface SfntTable {
  tag: string;
  checksum: number;
  data: Uint8Array;
}

function align4(length: number): number {
  return (length + 3) & ~3;
}

/** Rebuild a standalone sfnt from parsed WOFF1 tables. */
async function woffToSfnt(woff: Uint8Array): Promise<Uint8Array> {
  const numTables = readU16(woff, 12);
  const flavor = readU32(woff, 4);

  const tables: SfntTable[] = [];
  for (let i = 0; i < numTables; i++) {
    const dir = 44 + i * 20;
    const tag = readTag(woff, dir);
    const offset = readU32(woff, dir + 4);
    const compLength = readU32(woff, dir + 8);
    const origLength = readU32(woff, dir + 12);
    const checksum = readU32(woff, dir + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? await zlibDecompress(raw) : raw;
    if (data.length !== origLength) {
      throw new Error(`WOFF table ${tag} failed to decompress to ${origLength} bytes`);
    }
    tables.push({ tag, checksum, data });
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));

  const headerLength = 12 + numTables * 16;
  const total = headerLength + tables.reduce((sum, t) => sum + align4(t.data.length), 0);
  const out = new Uint8Array(total);
  writeU32(out, 0, flavor);
  const entrySelector = Math.floor(Math.log2(numTables));
  writeU16(out, 4, numTables);
  writeU16(out, 6, 2 ** entrySelector * 16);
  writeU16(out, 8, entrySelector);
  writeU16(out, 10, numTables * 16 - 2 ** entrySelector * 16);

  let dataOffset = headerLength;
  tables.forEach((table, i) => {
    const entry = 12 + i * 16;
    writeTag(out, entry, table.tag);
    writeU32(out, entry + 4, table.checksum);
    writeU32(out, entry + 8, dataOffset);
    writeU32(out, entry + 12, table.data.length);
    out.set(table.data, dataOffset);
    dataOffset += align4(table.data.length);
  });
  return out;
}

/** Wrap a standalone sfnt into the legacy WOFF1 container. */
async function sfntToWoff(sfnt: Uint8Array): Promise<Uint8Array> {
  const numTables = readU16(sfnt, 4);
  const flavor = readU32(sfnt, 0);

  const entries: { tag: string; compressed: Uint8Array; origLength: number; checksum: number }[] =
    [];
  for (let i = 0; i < numTables; i++) {
    const entry = 12 + i * 16;
    const offset = readU32(sfnt, entry + 8);
    const origLength = readU32(sfnt, entry + 12);
    const raw = sfnt.subarray(offset, offset + origLength);
    const compressed = await zlibCompress(raw);
    entries.push({
      tag: readTag(sfnt, entry),
      compressed: compressed.length < origLength ? compressed : raw,
      origLength,
      checksum: readU32(sfnt, entry + 4),
    });
  }

  const headerLength = 44 + numTables * 20;
  const totalSfntSize = 12 + numTables * 16 + entries.reduce((s, e) => s + align4(e.origLength), 0);
  const total = headerLength + entries.reduce((sum, e) => sum + e.compressed.length, 0);
  const out = new Uint8Array(total);
  writeU32(out, 0, FOURCC.woff);
  writeU32(out, 4, flavor);
  writeU32(out, 8, total);
  writeU16(out, 12, numTables);
  writeU32(out, 16, totalSfntSize);
  // meta/priv blocks are not produced

  let dataOffset = headerLength;
  entries.forEach((e, i) => {
    const dir = 44 + i * 20;
    writeTag(out, dir, e.tag);
    writeU32(out, dir + 4, dataOffset);
    writeU32(out, dir + 8, e.compressed.length);
    writeU32(out, dir + 12, e.origLength);
    writeU32(out, dir + 16, e.checksum);
    out.set(e.compressed, dataOffset);
    dataOffset += e.compressed.length;
  });
  return out;
}
// ---------------------------------------------------------------------------
// harfbuzz WASM binding
// ---------------------------------------------------------------------------

interface HarfbuzzExports {
  memory: WebAssembly.Memory;
  malloc(length: number): number;
  free(pointer: number): void;
  _initialize?(): void;
  hb_blob_create(
    data: number,
    length: number,
    mode: number,
    userData: number,
    destroy: number,
  ): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, length: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_add(set: number, codePoint: number): void;
  hb_set_clear(set: number): void;
  hb_set_invert(set: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_get_flags(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): number;
  hb_subset_input_set(input: number, set: number): number;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_input_pin_axis_location(
    input: number,
    face: number,
    tag: number,
    value: number,
  ): number;
  hb_subset_input_set_axis_range(
    input: number,
    face: number,
    tag: number,
    min: number,
    max: number,
    fallback: number,
  ): number;
  hb_subset_or_fail(face: number, input: number): number;
}

const HB_MEMORY_MODE_WRITABLE = 2;
const HB_SUBSET_SETS_DROP_TABLE_TAG = 3;
const HB_SUBSET_SETS_NAME_ID = 4;
const HB_SUBSET_SETS_LAYOUT_FEATURE_TAG = 6;
const HB_SUBSET_FLAGS_NO_HINTING = 1;
const HB_SUBSET_FLAGS_GLYPH_NAMES = 128;
const HB_SUBSET_FLAGS_NO_LAYOUT_CLOSURE = 512;

function hbTag(tag: string): number {
  return tag.split("").reduce((acc, ch) => (acc << 8) + ch.charCodeAt(0), 0);
}

interface HarfbuzzInstance {
  exports: HarfbuzzExports;
}

let harfbuzzPromise: Promise<HarfbuzzInstance> | null = null;

// rolldown-plugin-wasm generates the environment-specific loader: browsers
// fetch the emitted .wasm asset, Node reads it from disk.
async function loadHarfbuzz(): Promise<HarfbuzzInstance> {
  if (!harfbuzzPromise) {
    harfbuzzPromise = initHarfbuzzWasm().then((instance) => {
      const exports = instance.exports as unknown as HarfbuzzExports;
      exports._initialize?.();
      return { exports };
    });
  }
  return harfbuzzPromise;
}

// The harfbuzz instance keeps shared mutable state, so run one subset at a time.
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => T | Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function hbSubset(
  harfbuzz: HarfbuzzExports,
  font: Uint8Array,
  text: string | undefined,
  options: SubsetOptions,
  faceIndex = 0,
): Uint8Array {
  const { preserveNameIds, keepFeatures, variationAxes, noLayoutClosure } = options;

  const input = harfbuzz.hb_subset_input_create_or_fail();
  if (input === 0) {
    throw new Error("hb_subset_input_create_or_fail (harfbuzz) returned zero, indicating failure");
  }

  const fontBuffer = harfbuzz.malloc(font.byteLength);
  new Uint8Array(harfbuzz.memory.buffer).set(font, fontBuffer);

  const blob = harfbuzz.hb_blob_create(fontBuffer, font.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
  const face = harfbuzz.hb_face_create(blob, faceIndex);
  harfbuzz.hb_blob_destroy(blob);

  const layoutFeatures = harfbuzz.hb_subset_input_set(input, HB_SUBSET_SETS_LAYOUT_FEATURE_TAG);
  harfbuzz.hb_set_clear(layoutFeatures);
  if (keepFeatures === undefined) {
    // equivalent of --layout-features=*
    harfbuzz.hb_set_invert(layoutFeatures);
  } else {
    for (const feature of keepFeatures) harfbuzz.hb_set_add(layoutFeatures, hbTag(feature));
  }

  if (preserveNameIds) {
    const inputNameIds = harfbuzz.hb_subset_input_set(input, HB_SUBSET_SETS_NAME_ID);
    for (const nameId of preserveNameIds) harfbuzz.hb_set_add(inputNameIds, nameId);
  }

  let flags = harfbuzz.hb_subset_input_get_flags(input);
  if (noLayoutClosure) flags |= HB_SUBSET_FLAGS_NO_LAYOUT_CLOSURE;
  if (options.noHinting) flags |= HB_SUBSET_FLAGS_NO_HINTING;
  if (options.glyphNames) flags |= HB_SUBSET_FLAGS_GLYPH_NAMES;
  if (flags !== harfbuzz.hb_subset_input_get_flags(input)) {
    harfbuzz.hb_subset_input_set_flags(input, flags);
  }

  if (options.dropTables) {
    const inputDropTables = harfbuzz.hb_subset_input_set(input, HB_SUBSET_SETS_DROP_TABLE_TAG);
    for (const tag of options.dropTables) harfbuzz.hb_set_add(inputDropTables, hbTag(tag));
  }

  const inputUnicodes = harfbuzz.hb_subset_input_unicode_set(input);
  if (text === undefined) {
    // equivalent of --gids=*
    harfbuzz.hb_set_clear(inputUnicodes);
    harfbuzz.hb_set_invert(inputUnicodes);
  } else {
    for (const char of text) harfbuzz.hb_set_add(inputUnicodes, char.codePointAt(0) ?? 0);
  }

  if (variationAxes) {
    for (const [axisName, value] of Object.entries(variationAxes)) {
      if (typeof value === "number") {
        if (!harfbuzz.hb_subset_input_pin_axis_location(input, face, hbTag(axisName), value)) {
          harfbuzz.hb_face_destroy(face);
          harfbuzz.free(fontBuffer);
          throw new Error(
            `hb_subset_input_pin_axis_location (harfbuzz) returned zero when pinning ${axisName} to ${value}, indicating failure. Maybe the axis does not exist in the font?`,
          );
        }
      } else if (value && typeof value === "object") {
        if (typeof value.min !== "number" || typeof value.max !== "number") {
          harfbuzz.hb_face_destroy(face);
          harfbuzz.free(fontBuffer);
          throw new Error(
            `${axisName}: You must provide both a min and a max value when setting the axis range`,
          );
        }
        if (
          !harfbuzz.hb_subset_input_set_axis_range(
            input,
            face,
            hbTag(axisName),
            value.min,
            value.max,
            value.default ?? Number.NaN,
          )
        ) {
          harfbuzz.hb_face_destroy(face);
          harfbuzz.free(fontBuffer);
          throw new Error(
            `hb_subset_input_set_axis_range (harfbuzz) returned zero when setting the range of ${axisName} to [${value.min}; ${value.max}] and a default value of ${value.default}, indicating failure. Maybe the axis does not exist in the font?`,
          );
        }
      }
    }
  }

  let subset: number;
  try {
    subset = harfbuzz.hb_subset_or_fail(face, input);
    if (subset === 0) {
      throw new Error(
        "hb_subset_or_fail (harfbuzz) returned zero, indicating failure. Maybe the input file is corrupted?",
      );
    }
  } finally {
    harfbuzz.hb_subset_input_destroy(input);
  }

  const result = harfbuzz.hb_face_reference_blob(subset);
  const offset = harfbuzz.hb_blob_get_data(result, 0);
  const subsetByteLength = harfbuzz.hb_blob_get_length(result);
  if (subsetByteLength === 0) {
    harfbuzz.hb_blob_destroy(result);
    harfbuzz.hb_face_destroy(subset);
    harfbuzz.hb_face_destroy(face);
    harfbuzz.free(fontBuffer);
    throw new Error("Failed to create subset font, maybe the input file is corrupted?");
  }

  // The wasm heap may grow during subsetting, detaching earlier views, so take
  // a fresh view and copy the subset out.
  const out = new Uint8Array(harfbuzz.memory.buffer).slice(offset, offset + subsetByteLength);
  harfbuzz.hb_blob_destroy(result);
  harfbuzz.hb_face_destroy(subset);
  harfbuzz.hb_face_destroy(face);
  harfbuzz.free(fontBuffer);
  return out;
}
// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/** Subset a font to the given text (plus a basic Latin safety set). Returns
 * the subsetted font as bytes in the requested container format. */
export async function subsetFont(
  input: FontInput,
  text: string,
  options: SubsetOptions = {},
): Promise<Uint8Array> {
  const bytes = await toUint8Array(input);
  const inputFormat = detectFontFormat(bytes);
  const { targetFormat = inputFormat === "collection" ? "sfnt" : inputFormat, progressFunction } =
    options;

  progressFunction?.(0);
  let sfnt: Uint8Array;
  if (inputFormat === "woff") sfnt = await woffToSfnt(bytes);
  else if (inputFormat === "woff2") sfnt = await decompressWoff2(bytes);
  else sfnt = bytes;

  progressFunction?.(0.2);
  const harfbuzz = await loadHarfbuzz();
  const keepAllGlyphs = options.keepAllGlyphs === true;
  const subsetted = await serialized(() =>
    hbSubset(
      harfbuzz.exports,
      sfnt,
      keepAllGlyphs ? undefined : text,
      options,
      inputFormat === "collection" ? 0 : undefined,
    ),
  );

  progressFunction?.(0.8);
  let out: Uint8Array;
  if (targetFormat === "woff") out = await sfntToWoff(subsetted);
  else if (targetFormat === "woff2") out = await compressWoff2(subsetted);
  else out = subsetted;
  progressFunction?.(1);
  return out;
}
