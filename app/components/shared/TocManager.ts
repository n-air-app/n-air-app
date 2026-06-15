import { reactive } from 'vue';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

/**
 * Table of Contents (TOC) manager for handling section registration and ordering.
 * Manages section IDs, registration, and DOM-based ordering.
 * Uses reactive() to ensure reactivity.
 */
export class TocManager {
  // Use a reactive object instead of Map for Vue reactivity
  private sections: Record<string, TocSectionData[]> = reactive({});
  private counter = 0;

  /**
   * Generate a unique section ID
   */
  generateId(): string {
    return `toc-section-${this.counter++}`;
  }

  /**
   * Check if newElement should be inserted before existingElement in DOM order
   * @param newElement - The element being inserted
   * @param existingElement - An existing element to compare against
   * @returns true if newElement comes before existingElement in DOM
   */
  private shouldInsertBefore(newElement: HTMLElement, existingElement: HTMLElement): boolean {
    const position = newElement.compareDocumentPosition(existingElement);

    // DOCUMENT_POSITION_FOLLOWING (4): newElement comes before existingElement
    // DOCUMENT_POSITION_CONTAINED_BY (16): existingElement is inside newElement (newElement is parent)
    return (
      position === Node.DOCUMENT_POSITION_FOLLOWING
      || position === Node.DOCUMENT_POSITION_CONTAINED_BY
      || (position & Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0
    );
  }

  /**
   * Find the insertion index for a new section based on DOM order
   * @param sections - Existing sections in the category
   * @param newElement - The DOM element of the new section
   * @returns The index where the new section should be inserted
   */
  private findInsertionIndex(sections: TocSectionData[], newElement: HTMLElement): number {
    for (let i = 0; i < sections.length; i++) {
      const existingElement = document.getElementById(sections[i].id);
      if (existingElement && this.shouldInsertBefore(newElement, existingElement)) {
        return i;
      }
    }
    return sections.length; // Append to end if not found
  }

  /**
   * Check if the section is a consecutive duplicate of the previous section
   * @param sections - Existing sections in the category
   * @param insertIndex - The proposed insertion index
   * @param section - The section to check
   * @returns true if this is a consecutive duplicate
   */
  private isConsecutiveDuplicate(
    sections: TocSectionData[],
    insertIndex: number,
    section: TocSectionData,
  ): boolean {
    if (insertIndex === 0) {
      return false;
    }
    const prevSection = sections[insertIndex - 1];
    return prevSection.level === section.level && prevSection.title === section.title;
  }

  /**
   * Register a TOC section for a specific category
   * @param categoryName - The category this section belongs to
   * @param section - The section data to register
   */
  register(categoryName: string, section: TocSectionData): void {
    const sections = this.sections[categoryName] || [];

    // Check if section already exists (avoid duplicates on re-render)
    if (sections.some((s) => s.id === section.id)) {
      return;
    }

    // Determine insertion position based on DOM order
    const element = document.getElementById(section.id);
    const insertIndex = element ? this.findInsertionIndex(sections, element) : sections.length;

    // Check for consecutive duplicate at insertion position
    if (this.isConsecutiveDuplicate(sections, insertIndex, section)) {
      return; // Skip consecutive duplicate with same level and title
    }

    // Insert at the calculated position
    sections.splice(insertIndex, 0, section);

    // Update order based on array index
    sections.forEach((s, index) => (s.order = index));

    // Store updated sections
    this.sections[categoryName] = sections;
  }

  /**
   * Unregister a TOC section from a specific category
   * @param categoryName - The category this section belongs to
   * @param sectionId - The section ID to unregister
   */
  unregister(categoryName: string, sectionId: string): void {
    const sections = this.sections[categoryName] || [];
    const filtered = sections.filter((s) => s.id !== sectionId);
    this.sections[categoryName] = filtered;
  }

  /**
   * Get all sections for a specific category
   * @param categoryName - The category to get sections for
   * @returns Array of section data, or empty array if none exist
   */
  getSections(categoryName: string): TocSectionData[] {
    return this.sections[categoryName] || [];
  }

  /**
   * Clear all sections for a specific category
   * @param categoryName - The category to clear
   */
  clear(categoryName: string): void {
    delete this.sections[categoryName];
  }

  /**
   * Clear all sections for all categories
   */
  clearAll(): void {
    Object.keys(this.sections).forEach((key) => {
      delete this.sections[key];
    });
  }
}
