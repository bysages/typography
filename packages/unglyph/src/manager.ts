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
 * Glyph manager for CRUD operations
 */
export class GlyphManager {
  private glyphs: Map<string | number, GlyphData> = new Map();

  constructor(initialGlyphs: GlyphData[] = []) {
    for (const glyph of initialGlyphs) {
      this.glyphs.set(glyph.unicode, glyph);
    }
  }

  /**
   * Add a glyph
   */
  add(glyph: GlyphData): void {
    this.glyphs.set(glyph.unicode, glyph);
  }

  /**
   * Get a glyph by unicode
   */
  get(unicode: string | number): GlyphData | undefined {
    return this.glyphs.get(unicode);
  }

  /**
   * Update a glyph
   */
  update(unicode: string | number, updates: Partial<GlyphData>): boolean {
    const existing = this.glyphs.get(unicode);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    this.glyphs.set(unicode, updated);
    return true;
  }

  /**
   * Remove a glyph
   */
  remove(unicode: string | number): boolean {
    return this.glyphs.delete(unicode);
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
  has(unicode: string | number): boolean {
    return this.glyphs.has(unicode);
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
          this.update(op.unicode, op.updates);
          break;
        case "remove":
          this.remove(op.unicode);
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
   * Find glyph by unicode
   */
  findByUnicode(unicode: string | number): GlyphData | undefined {
    return this.glyphs.get(unicode);
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
