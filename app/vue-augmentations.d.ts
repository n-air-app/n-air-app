import { VueI18n } from 'vue-i18n';
import { Store } from 'vuex';

// Vue instance type augmentations
declare module 'vue/types/vue' {
  interface Vue { }
}

// Vue component options augmentations
declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    i18n?: VueI18n;
    store?: Store<unknown>;
  }
}
