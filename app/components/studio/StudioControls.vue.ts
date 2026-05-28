import Mixer from 'components/studio/Mixer.vue';
import SceneSelector from 'components/studio/SceneSelector.vue';
import SourceSelector from 'components/studio/SourceSelector.vue';
import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
import { SceneCollectionsService } from 'services/scene-collections';
import { defineComponent, onMounted, ref } from 'vue';

import ControlsArrow from '../../../media/images/controls-arrow.svg';

function clampHeight(h: number): number {
  if (h <= 0) return CustomizationService.defaultState.studioControlsHeight;
  const minHeight = 40;
  const maxHeight = window.innerHeight - 200;
  return Math.min(maxHeight, Math.max(minHeight, h));
}

export default defineComponent({
  name: 'StudioControls',

  components: {
    SceneSelector,
    SourceSelector,
    Mixer,
    ControlsArrow,
  },

  setup() {
    const currentHeight = ref(CustomizationService.defaultState.studioControlsHeight);

    onMounted(() => {
      currentHeight.value = clampHeight(CustomizationService.instance.state.studioControlsHeight);
    });

    function onDrag(e: MouseEvent) {
      const deltaY = startY - e.clientY;
      currentHeight.value = clampHeight(currentHeight.value + deltaY);
      startY = e.clientY;
    }

    function onDragEnd() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
      CustomizationService.instance.setStudioControlsHeight(currentHeight.value);
    }

    let startY = 0;
    function onDragStart(e: MouseEvent) {
      startY = e.clientY;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
    }

    return { currentHeight, onDragStart };
  },

  computed: {
    opened() {
      return CustomizationService.instance.studioControlsOpened;
    },

    isCompactMode() {
      return CompactModeService.instance.isCompactMode;
    },

    compactModeStudioController: {
      get(): 'scenes' | 'mixer' {
        return CompactModeService.instance.compactModeStudioController;
      },
      set(controller: 'scenes' | 'mixer') {
        CompactModeService.instance.compactModeStudioController = controller;
      },
    },

    activeCollection() {
      return SceneCollectionsService.instance.activeCollection;
    },
  },

  methods: {
    onToggleControls() {
      CustomizationService.instance.toggleStudioControls();
    },
  },
});
