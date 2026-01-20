import Vue from 'vue';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

/**
 * Table of Contents (TOC) manager for handling section registration and ordering.
 * Manages section IDs, registration, and DOM-based ordering.
 * Uses Vue.observable to ensure reactivity.
 */
export class TocManager {
  // Use a reactive object instead of Map for Vue reactivity
  private sections: Record<string, TocSectionData[]> = Vue.observable({});
  private counter = 0;

  /**
   * Generate a unique section ID
   */
  generateId(): string {
    return `toc-section-${this.counter++}`;
  }

  /**
   * Register a TOC section for a specific category
   * @param categoryName - The category this section belongs to
   * @param section - The section data to register
   */
  register(categoryName: string, section: TocSectionData): void {
    const sections = this.sections[categoryName] || [];

    // Check if section already exists (avoid duplicates on re-render)
    if (sections.some(s => s.id === section.id)) {
      return;
    }

    // Determine insertion position based on DOM order
    const element = document.getElementById(section.id);
    let insertIndex = sections.length; // Default: append to end

    if (element) {
      // Find the correct position based on DOM order
      for (let i = 0; i < sections.length; i++) {
        const existingElement = document.getElementById(sections[i].id);
        if (existingElement) {
          const position = element.compareDocumentPosition(existingElement);

          // DOCUMENT_POSITION_FOLLOWING (4): element comes before existingElement
          // DOCUMENT_POSITION_CONTAINED_BY (16): existingElement is inside element (element is parent)
          if (
            position === Node.DOCUMENT_POSITION_FOLLOWING ||
            position === Node.DOCUMENT_POSITION_CONTAINED_BY ||
            (position & Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0
          ) {
            // element comes before existingElement in DOM, or element contains existingElement
            insertIndex = i;
            break;
          }
        }
      }
    }

    // Check for consecutive duplicate at insertion position
    if (insertIndex > 0) {
      const prevSection = sections[insertIndex - 1];
      if (prevSection.level === section.level && prevSection.title === section.title) {
        // Skip consecutive duplicate with same level and title
        return;
      }
    }

    // Insert at the calculated position
    sections.splice(insertIndex, 0, section);

    // Update order based on array index
    sections.forEach((s, index) => (s.order = index));

    // Store updated sections (use Vue.set for reactivity)
    Vue.set(this.sections, categoryName, sections);
  }

  /**
   * Unregister a TOC section from a specific category
   * @param categoryName - The category this section belongs to
   * @param sectionId - The section ID to unregister
   */
  unregister(categoryName: string, sectionId: string): void {
    const sections = this.sections[categoryName] || [];
    const filtered = sections.filter(s => s.id !== sectionId);
    Vue.set(this.sections, categoryName, filtered);
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
    Vue.delete(this.sections, categoryName);
  }

  /**
   * Clear all sections for all categories
   */
  clearAll(): void {
    Object.keys(this.sections).forEach(key => {
      Vue.delete(this.sections, key);
    });
  }
}
