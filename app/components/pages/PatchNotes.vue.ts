import { NavigationService } from 'services/navigation';
import { PatchNotesService } from 'services/patch-notes';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Dashboard',

  computed: {
    notes() {
      return PatchNotesService.instance().notes;
    },
  },

  methods: {
    done() {
      NavigationService.instance().navigate('Studio');
    },
  },
});
