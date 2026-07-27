import GenericForm from 'components/obs/inputs/GenericForm.vue';
import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import NavItem from 'components/shared/NavItem.vue';
import NavMenu from 'components/shared/NavMenu.vue';
import { ISourceFilter, SourceFiltersService } from 'services/source-filters';
import { SourcesService } from 'services/sources';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

import TreeView from '../shared/tree-view/TreeView.vue';
import { ITreeCursorPosition, ITreeNodeModel } from '../shared/tree-view/types';

interface IFilterNodeData {
  visible: boolean;
}

export default defineComponent({
  name: 'SourceFilters',

  components: {
    ModalLayout,
    NavMenu,
    NavItem,
    GenericForm,
    Display,
    TreeView,
  },

  data() {
    const windowOptions = WindowsService.instance().getChildWindowQueryParams() as {
      sourceId: string;
      selectedFilterName: string;
    };
    const sourceId = windowOptions.sourceId;
    const filters = SourceFiltersService.instance().getFilters(sourceId);
    const selectedFilterName = windowOptions.selectedFilterName || (filters[0] && filters[0].name) || null;
    const properties = selectedFilterName
      ? SourceFiltersService.instance().getPropertiesFormData(sourceId, selectedFilterName)
      : [];
    return {
      windowOptions,
      sourceId,
      filters,
      selectedFilterName,
      properties,
    };
  },

  computed: {
    sourceDisplayName(): string {
      return SourcesService.instance().getSource(this.sourceId)?.name ?? '';
    },

    nodes() {
      return this.filters.map((filter: ISourceFilter) => {
        return {
          title: filter.name,
          isSelected: filter.name === this.selectedFilterName,
          isLeaf: true,
          data: {
            visible: filter.visible,
          },
        };
      });
    },
  },

  watch: {
    selectedFilterName: {
      handler(): void {
        this.properties = this.selectedFilterName
          ? SourceFiltersService.instance().getPropertiesFormData(this.sourceId, this.selectedFilterName)
          : [];
      },
    },
  },

  methods: {
    onPropertiesInput(v: typeof this.properties, _index: number): void {
      this.properties = v;
      this.save();
    },

    save(): void {
      if (!this.selectedFilterName) return;
      SourceFiltersService.instance().setPropertiesFormData(
        this.sourceId,
        this.selectedFilterName,
        this.properties,
      );
      this.properties = SourceFiltersService.instance().getPropertiesFormData(
        this.sourceId,
        this.selectedFilterName,
      );
    },

    done(): void {
      WindowsService.instance().closeChildWindow();
    },

    addFilter(): void {
      SourceFiltersService.instance().showAddSourceFilter(this.sourceId);
    },

    removeFilter(): void {
      if (!this.selectedFilterName) return;
      SourceFiltersService.instance().remove(this.sourceId, this.selectedFilterName);
      this.filters = SourceFiltersService.instance().getFilters(this.sourceId);
      this.selectedFilterName = (this.filters[0] && this.filters[0].name) || null;
    },

    toggleVisibility(filterName: string): void {
      const sourceFilter = this.filters.find((filter: ISourceFilter) => filter.name === filterName);
      if (!sourceFilter) return;
      SourceFiltersService.instance().setVisibility(
        this.sourceId,
        sourceFilter.name,
        !sourceFilter.visible,
      );
      this.filters = SourceFiltersService.instance().getFilters(this.sourceId);
    },

    makeActive(filterDescr: any[]): void {
      this.selectedFilterName = filterDescr[0]?.title ?? null;
    },

    handleSort(
      nodes: ITreeNodeModel<IFilterNodeData>[],
      position: ITreeCursorPosition<IFilterNodeData>,
    ): void {
      if (!Array.isArray(nodes)) return;
      const sourceNode = nodes[0];
      const sourceInd = this.filters.findIndex((filter: ISourceFilter) => filter.name === sourceNode.title);
      let targetInd = this.filters.findIndex((filter: ISourceFilter) => filter.name === position.node.title);

      if (sourceInd < targetInd) {
        targetInd = position.placement === 'before' ? targetInd - 1 : targetInd;
      } else if (sourceInd > targetInd) {
        targetInd = position.placement === 'before' ? targetInd : targetInd + 1;
      }
      if (!this.selectedFilterName) return;
      SourceFiltersService.instance().setOrder(
        this.sourceId,
        this.selectedFilterName,
        targetInd - sourceInd,
      );
      this.filters = SourceFiltersService.instance().getFilters(this.sourceId);
    },
  },
});
