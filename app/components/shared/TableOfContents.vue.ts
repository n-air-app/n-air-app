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
}
