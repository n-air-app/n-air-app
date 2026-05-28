import * as inputComponents from 'components/obs/inputs';
import GenericForm from 'components/obs/inputs/GenericForm.vue';
import { IObsInput, IObsListInput, TObsFormData } from 'components/obs/inputs/ObsInput';
import { $t } from 'services/i18n';
import { ETransitionType, TransitionsService } from 'services/transitions';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TransitionSettings',
  components: {
    GenericForm,
    ...inputComponents,
  },
  props: {
    transitionId: { type: String, required: true },
  },
  data() {
    return {
      localType: TransitionsService.instance.getTransition(this.transitionId).type as ETransitionType,
      properties: TransitionsService.instance.getPropertiesFormData(this.transitionId),
    };
  },
  computed: {
    typeModel: {
      get(): IObsListInput<ETransitionType> {
        return {
          description: $t('transitions.transitionType'),
          name: 'type',
          value: this.localType,
          options: TransitionsService.instance.getTypes(),
        };
      },
      set(model: IObsListInput<ETransitionType>) {
        this.localType = model.value;
        TransitionsService.instance.changeTransitionType(this.transitionId, model.value);
        this.properties = TransitionsService.instance.getPropertiesFormData(this.transitionId);
      },
    },
    durationModel: {
      get(): IObsInput<number> {
        return {
          description: $t('transitions.duration'),
          name: 'duration',
          value: this.transition.duration,
        };
      },
      set(model: IObsInput<number>) {
        TransitionsService.instance.setDuration(this.transitionId, model.value);
      },
    },
    nameModel: {
      get(): IObsInput<string> {
        return {
          description: $t('transitions.transitionName'),
          name: 'name',
          value: this.transition.name,
        };
      },
      set(name: IObsInput<string>) {
        TransitionsService.instance.renameTransition(this.transitionId, name.value);
      },
    },
    transition() {
      return TransitionsService.instance.getTransition(this.transitionId);
    },
  },
  methods: {
    saveProperties(props: TObsFormData) {
      TransitionsService.instance.setPropertiesFormData(this.transitionId, props);
    },
  },
});

