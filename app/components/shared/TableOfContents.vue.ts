import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

@Component({})
export default class TableOfContents extends Vue {
  @Prop({ required: true }) sections!: TocSectionData[];
  @Prop({ default: null }) activeId!: string | null;

  public onNavigate(id: string): void {
    this.$emit('navigate', id);
  }
}
