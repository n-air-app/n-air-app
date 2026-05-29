import * as inputComponents from 'components/obs/inputs';
import { IObsListInput } from 'components/obs/inputs/ObsInput';
import { $t } from 'services/i18n';
import { ScenesService } from 'services/scenes';
import { TransitionsService } from 'services/transitions';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ConnectionSettings',
  components: {
    ...inputComponents,
  },
  props: {
    connectionId: { type: String, required: true },
  },
  computed: {
    fromSceneModel: {
      get(): IObsListInput<string> {
        return {
          description: $t('transitions.connectionFrom'),
          name: 'from',
          value: this.connection.fromSceneId,
          options: this.sceneOptions,
        };
      },
      set(model: IObsListInput<string>) {
        TransitionsService.instance().updateConnection(this.connectionId, {
          fromSceneId: model.value,
        });
      },
    },
    toSceneModel: {
      get(): IObsListInput<string> {
        return {
          description: $t('transitions.connectionTo'),
          name: 'to',
          value: this.connection.toSceneId,
          options: this.sceneOptions,
        };
      },
      set(model: IObsListInput<string>) {
        TransitionsService.instance().updateConnection(this.connectionId, {
          toSceneId: model.value,
        });
      },
    },
    transitionModel: {
      get(): IObsListInput<string> {
        return {
          description: $t('transitions.sceneTransition'),
          name: 'transition',
          value: this.connection.transitionId,
          options: this.transitionOptions,
        };
      },
      set(model: IObsListInput<string>) {
        TransitionsService.instance().updateConnection(this.connectionId, {
          transitionId: model.value,
        });
      },
    },
    connection() {
      return TransitionsService.instance().getConnection(this.connectionId);
    },
    sceneOptions() {
      return ScenesService.instance().scenes.map((scene: any) => ({
        description: scene.name,
        value: scene.id,
      }));
    },
    transitionOptions() {
      return TransitionsService.instance().state.transitions.map((transition: any) => ({
        description: transition.name,
        value: transition.id,
      }));
    },
  },
});
