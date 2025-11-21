import type { GlyphData, GlyphOperation } from "./types";

/**
 * Create a new GlyphManager instance
 */
export function createGlyphManager(
  initialGlyphs: GlyphData[] = [],
): GlyphManager {
  return new GlyphManager(initialGlyphs);
}

/**
 * Glyph manager for CRUD operations using unified GlyphData
 */
export class GlyphManager {
  private glyphs: Map<number, GlyphData> = new Map();

  constructor(initialGlyphs: GlyphData[] = []) {
    for (const glyph of initialGlyphs) {
      this.glyphs.set(glyph.index, glyph);
    }
  }

  /**
   * Add a glyph
   */
  add(glyph: GlyphData): void {
    this.glyphs.set(glyph.index, glyph);
  }

  /**
   * Get a glyph by id
   */
  get(id: number): GlyphData | undefined {
    return this.glyphs.get(id);
  }

  /**
   * Update a glyph
   */
  update(id: number, updates: Partial<GlyphData>): boolean {
    const existing = this.glyphs.get(id);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    this.glyphs.set(id, updated);
    return true;
  }

  /**
   * Remove a glyph
   */
  remove(id: number): boolean {
    return this.glyphs.delete(id);
  }

  /**
   * Get all glyphs
   */
  list(): GlyphData[] {
    return Array.from(this.glyphs.values());
  }

  /**
   * Get glyph count
   */
  count(): number {
    return this.glyphs.size;
  }

  /**
   * Check if glyph exists
   */
  has(id: number): boolean {
    return this.glyphs.has(id);
  }

  /**
   * Execute batch operations
   */
  batch(operations: GlyphOperation[]): void {
    for (const op of operations) {
      switch (op.type) {
        case "add":
          this.add(op.glyph);
          break;
        case "update":
          this.update(op.index, op.updates);
          break;
        case "remove":
          this.remove(op.index);
          break;
      }
    }
  }

  /**
   * Find glyphs matching predicate
   */
  find(predicate: (glyph: GlyphData) => boolean): GlyphData[] {
    return this.list().filter(predicate);
  }

  /**
   * Find glyph by unicode (checks unicode property or codePoints)
   */
  findByUnicode(unicode: string | number): GlyphData | undefined {
    const codePoint =
      typeof unicode === "string" ? unicode.charCodeAt(0) : unicode;

    for (const glyph of this.glyphs.values()) {
      // Check unicode property
      if (typeof glyph.unicode === "string") {
        if (glyph.unicode.charCodeAt(0) === codePoint) return glyph;
      } else {
        if (glyph.unicode === codePoint) return glyph;
      }

      // Check codePoints array
      if (glyph.codePoints && glyph.codePoints.includes(codePoint)) {
        return glyph;
      }
    }
    return undefined;
  }

  /**
   * Find glyph by name
   */
  findByName(name: string): GlyphData | undefined {
    for (const glyph of this.glyphs.values()) {
      if (glyph.name === name) {
        return glyph;
      }
    }
    return undefined;
  }

  /**
   * Add multiple glyphs
   */
  addGlyphs(glyphs: GlyphData[]): void {
    for (const glyph of glyphs) {
      this.add(glyph);
    }
  }

  /**
   * Check if manager is empty
   */
  isEmpty(): boolean {
    return this.glyphs.size === 0;
  }

  /**
   * Clear all glyphs
   */
  clear(): void {
    this.glyphs.clear();
  }
}
