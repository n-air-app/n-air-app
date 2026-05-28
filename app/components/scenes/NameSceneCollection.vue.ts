import ModalLayout from 'components/shared/ModalLayout.vue';
import { $t } from 'services/i18n';
import { SceneCollectionsService } from 'services/scene-collections';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

interface INameSceneCollectionOptions {
  rename?: string;
  sceneCollectionToDuplicate?: string;
}

export default defineComponent({
  name: 'NameSceneCollection',

  components: { ModalLayout },

  data() {
    return {
      name: '',
      error: '',
      options: WindowsService.instance.getChildWindowQueryParams() as INameSceneCollectionOptions,
    };
  },

  mounted() {
    const suggestedName =
      this.options.sceneCollectionToDuplicate || $t('scenes.newSceneCollectionName');
    this.name = SceneCollectionsService.instance.suggestName(suggestedName);
  },

  methods: {
    submit() {
      if (this.isTaken(this.name)) {
        this.error = $t('scenes.alreadyTakenName');
      } else if (this.options.rename) {
        SceneCollectionsService.instance.rename(this.name);
        WindowsService.instance.closeChildWindow();
      } else if (this.options.sceneCollectionToDuplicate) {
        SceneCollectionsService.instance.duplicate(this.name);
        WindowsService.instance.closeChildWindow();
      } else {
        SceneCollectionsService.instance.create({ name: this.name });
        WindowsService.instance.closeChildWindow();
      }
    },

    isTaken(name: string) {
      return !!SceneCollectionsService.instance.collections.find((coll: any) => {
        return coll.name === name;
      });
    },
  },
});
