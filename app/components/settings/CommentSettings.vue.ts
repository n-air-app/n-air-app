import * as remote from '@electron/remote';
import Dropdown from 'components/shared/Dropdown.vue';
import TocSection from 'components/shared/TocSection.vue';
import { HttpRelation } from 'services/nicolive-program/httpRelation';
import { NicoliveCommentLocalFilterService } from 'services/nicolive-program/nicolive-comment-local-filter';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { NicoliveProgramStateService } from 'services/nicolive-program/state';
import { defineComponent } from 'vue';

type MethodObject = {
  text: string;
  value: string;
};

export default defineComponent({
  name: 'CommentSettings',
  components: {
    Dropdown,
    TocSection,
  },
  data() {
    return {
      useOneComme: false,
      removeComment: true,
      isOneCommeError: false,
      httpRelationMethods: [
        { value: '', text: '---' },
        { value: 'GET', text: 'GET' },
        { value: 'POST', text: 'POST' },
        { value: 'PUT', text: 'PUT' },
      ] as MethodObject[],
    };
  },
  computed: {
    nameplateEnabled: {
      get(): boolean {
        return NicoliveProgramStateService.instance().state.nameplateEnabled;
      },
      set(e: boolean) {
        NicoliveProgramStateService.instance().updateNameplateEnabled(e);
      },
    },
    showAnonymous: {
      get() {
        return NicoliveCommentLocalFilterService.instance().showAnonymous;
      },
      set(v: boolean) {
        NicoliveCommentLocalFilterService.instance().showAnonymous = v;
      },
    },
    httpRelationMethod: {
      get(): MethodObject {
        const value = NicoliveProgramStateService.instance().state.httpRelation.method;
        const obj = this.httpRelationMethods.find((a: any) => a.value === value);
        return obj ?? this.httpRelationMethods[0];
      },
      set(method: MethodObject) {
        NicoliveProgramStateService.instance().updateHttpRelation({ method: method.value });
      },
    },
    httpRelationUrl: {
      get(): string {
        return NicoliveProgramStateService.instance().state.httpRelation.url;
      },
      set(url: string) {
        NicoliveProgramStateService.instance().updateHttpRelation({ url });
      },
    },
    httpRelationBody: {
      get(): string {
        return NicoliveProgramStateService.instance().state.httpRelation.body;
      },
      set(body: string) {
        NicoliveProgramStateService.instance().updateHttpRelation({ body });
      },
    },
  },
  watch: {
    async useOneComme() {
      const use = this.useOneComme;
      this.isOneCommeError = false;
      if (use === NicoliveProgramStateService.instance().state.onecommeRelation.use) return;
      if (use) {
        if (!(await NicoliveProgramService.instance().oneCommeRelation.testConnection())) {
          this.isOneCommeError = true;
        }
      }
      NicoliveProgramStateService.instance().updateOneCommeRelation({ use });
      if (use) NicoliveProgramService.instance().oneCommeRelation.update({ force: true });
    },
    removeComment() {
      const removeComment = this.removeComment;
      NicoliveProgramStateService.instance().updateOneCommeRelation({ removeComment });
    },
  },
  mounted() {
    this.initOneComme();
  },
  methods: {
    initOneComme() {
      this.useOneComme = NicoliveProgramStateService.instance().state.onecommeRelation.use;
      this.removeComment = NicoliveProgramStateService.instance().state.onecommeRelation.removeComment;
    },
    showOneCommeInfo() {
      remote.shell.openExternal('https://onecomme.com/docs/about');
    },
    testHttpRelation() {
      HttpRelation.sendTest(NicoliveProgramStateService.instance().state.httpRelation).then();
    },
    showHttpRelationPage() {
      remote.shell.openExternal('https://github.com/n-air-app/n-air-app/wiki/http_relation');
    },
  },
});
