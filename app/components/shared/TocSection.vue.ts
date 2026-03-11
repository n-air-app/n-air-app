import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

@Component({
  inject: {
    getTocSectionId: { from: 'getTocSectionId' },
    registerTocSection: { from: 'registerTocSection' },
    unregisterTocSection: { from: 'unregisterTocSection' },
    parentTocLevel: { from: 'tocLevel', default: undefined },
  },
  provide(this: TocSection) {
    return {
      tocLevel: this.computedLevel,
    };
  },
})
export default class TocSection extends Vue {
  @Prop({ required: true }) title!: string;
  @Prop() id?: string;
  @Prop() level?: number;
  @Prop({ default: true }) visible!: boolean;

  getTocSectionId!: () => string;
  registerTocSection!: (section: TocSectionData) => string;
  unregisterTocSection!: (categoryName: string, sectionId: string) => void;
  parentTocLevel!: number | undefined;

  private _generatedId?: string;
  private _registeredCategoryName?: string;

  get sectionId() {
    if (this.id) {
      return this.id;
    }
    if (!this._generatedId) {
      this._generatedId = this.getTocSectionId();
    }
    return this._generatedId;
  }

  get computedLevel(): number {
    // 明示的に level が指定されている場合はそれを使用
    if (this.level !== undefined) {
      return this.level;
    }
    // 親の TocSection がある場合は親の level + 1
    if (this.parentTocLevel !== undefined) {
      return this.parentTocLevel + 1;
    }
    // それ以外はデフォルトで 1
    return 1;
  }

  mounted() {
    if (this.visible) {
      // Use $nextTick to ensure all components are mounted before registering
      this.$nextTick(() => {
        if (this.registerTocSection && typeof this.registerTocSection === 'function') {
          this._registeredCategoryName = this.registerTocSection({
            id: this.sectionId,
            title: this.title,
            order: 0, // Will be recalculated based on DOM position
            level: this.computedLevel,
          });
        }
      });
    }
  }

  beforeDestroy() {
    if (this._registeredCategoryName) {
      this.unregisterTocSection(this._registeredCategoryName, this.sectionId);
    }
  }
}
