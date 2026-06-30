import * as remote from '@electron/remote';
import Selector from 'components/shared/Selector.vue';
import cloneDeep from 'lodash/cloneDeep';
import { $t } from 'services/i18n';
import { Menu } from 'util/menus/Menu';
import { defineComponent, PropType } from 'vue';

import { IObsEditableListInputValue, TObsType } from './ObsInput';

interface ISelectorSortEventData {
  change: any;
  order: string[];
}

const ObsEditableListProperty = defineComponent({
  name: 'ObsEditableListProperty',
  emits: ['input'],
  components: { Selector },
  props: {
    value: { type: Object as PropType<IObsEditableListInputValue>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/EditableList/${this.value.name}`,
      activeItem: '' as string,
      menu: new Menu(),
    };
  },
  computed: {
    list(): string[] {
      const items = this.value.value || [];
      return cloneDeep(items.map((item: any) => item.value));
    },
  },
  created() {
    this.menu.append({
      id: 'Add Files',
      label: $t('settings.addFiles'),
      click: () => {
        this.showFileDialog();
      },
    });
    this.menu.append({
      id: 'Add Directory',
      label: $t('settings.addDirectory'),
      click: () => {
        this.showDirDialog();
      },
    });
  },
  methods: {
    emitInput(eventData: IObsEditableListInputValue) {
      this.$emit('input', eventData);
    },
    handleSelect(item: string) {
      this.activeItem = item;
    },
    handleSort(data: ISelectorSortEventData) {
      this.setList(data.order);
    },
    handleRemove() {
      this.setList(this.list.filter((item: string) => item !== this.activeItem));
    },
    handleEdit() {
      this.showReplaceFileDialog();
    },
    async showReplaceFileDialog() {
      const { filePaths } = await remote.dialog.showOpenDialog({
        defaultPath: this.value.defaultPath,
        filters: this.value.filters,
        properties: ['openFile'],
      });
      if (filePaths && filePaths.length) {
        const activeIndex = this.list.indexOf(this.activeItem);
        this.list[activeIndex] = filePaths[0];
        this.activeItem = this.list[activeIndex];
        this.setList(this.list);
      }
    },
    async showFileDialog() {
      const { filePaths } = await remote.dialog.showOpenDialog({
        defaultPath: this.value.defaultPath,
        filters: this.value.filters,
        properties: ['openFile', 'multiSelections'],
      });
      if (filePaths && filePaths.length) {
        this.setList(this.list.concat(filePaths));
      }
    },
    async showDirDialog() {
      const { filePaths } = await remote.dialog.showOpenDialog({
        defaultPath: this.value.defaultPath,
        properties: ['openDirectory'],
      });
      if (filePaths && filePaths.length) {
        this.setList(this.list.concat(filePaths));
      }
    },
    setList(list: string[]) {
      this.emitInput({ ...this.value, value: list.map((item) => ({ value: item })) });
    },
  },
});
export default Object.assign(ObsEditableListProperty, { obsType: 'OBS_PROPERTY_EDITABLE_LIST' as TObsType });
