import GenericForm from 'components/obs/inputs/GenericForm.vue';
import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import NavItem from 'components/shared/NavItem.vue';
import NavMenu from 'components/shared/NavMenu.vue';
import { SourceFiltersService } from 'services/source-filters';
import { SourcesService } from 'services/sources';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

import SlVueTree, { ICursorPosition, ISlTreeNodeModel } from '../shared/sl-vue-tree';

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
    SlVueTree,
  },

  data() {
    const windowOptions = WindowsService.instance().getChildWindowQueryParams() as {
      sourceId: string;
      selectedFilterName: string;
    };
    const sourceId = windowOptions.sourceId;
    const filters = SourceFiltersService.instance().getFilters(sourceId);
    const selectedFilterName = windowOptions.selectedFilterName || (filters[0] && filters[0].name) || null;
    const properties = SourceFiltersService.instance().getPropertiesFormData(
      sourceId,
      selectedFilterName,
    );
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
      return SourcesService.instance().getSource(this.sourceId).name;
    },

    nodes() {
      return this.filters.map((filter) => {
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
        this.properties = SourceFiltersService.instance().getPropertiesFormData(
          this.sourceId,
          this.selectedFilterName,
        );
      },
    },
  },

  methods: {
    save(): void {
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
      SourceFiltersService.instance().remove(this.sourceId, this.selectedFilterName);
      this.filters = SourceFiltersService.instance().getFilters(this.sourceId);
      this.selectedFilterName = (this.filters[0] && this.filters[0].name) || null;
    },

    toggleVisibility(filterName: string): void {
      const sourceFilter = this.filters.find((filter) => filter.name === filterName);
      SourceFiltersService.instance().setVisibility(
        this.sourceId,
        sourceFilter.name,
        !sourceFilter.visible,
      );
      this.filters = SourceFiltersService.instance().getFilters(this.sourceId);
    },

    makeActive(filterDescr: any[]): void {
      this.selectedFilterName = filterDescr[0].title;
    },

    handleSort(
      nodes: ISlTreeNodeModel<IFilterNodeData>[],
      position: ICursorPosition<IFilterNodeData>,
    ): void {
      const sourceNode = nodes[0];
      const sourceInd = this.filters.findIndex((filter) => filter.name === sourceNode.title);
      let targetInd = this.filters.findIndex((filter) => filter.name === position.node.title);

      if (sourceInd < targetInd) {
        targetInd = position.placement === 'before' ? targetInd - 1 : targetInd;
      } else if (sourceInd > targetInd) {
        targetInd = position.placement === 'before' ? targetInd : targetInd + 1;
      }
      SourceFiltersService.instance().setOrder(
        this.sourceId,
        this.selectedFilterName,
        targetInd - sourceInd,
      );
      this.filters = SourceFiltersService.instance().getFilters(this.sourceId);
    },
  },
});
