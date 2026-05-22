import * as remote from '@electron/remote';
import Dropdown from 'components/shared/Dropdown.vue';
import TocSection from 'components/shared/TocSection.vue';
import { Inject } from 'services/core/injector';
import { HttpRelation } from 'services/nicolive-program/httpRelation';
import { NicoliveCommentLocalFilterService } from 'services/nicolive-program/nicolive-comment-local-filter';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { NicoliveProgramStateService } from 'services/nicolive-program/state';
import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';

type MethodObject = {
  text: string;
  value: string;
};

@Component({
  components: {
    Dropdown,
    TocSection,
  },
})
export default class CommentSettings extends Vue {
  @Inject()
  private nicoliveCommentLocalFilterService: NicoliveCommentLocalFilterService;
  @Inject()
  private nicoliveProgramStateService: NicoliveProgramStateService;
  @Inject()
  private nicoliveProgramService: NicoliveProgramService;

  mounted() {
    this.initOneComme();
  }

  get nameplateEnabled(): boolean {
    return this.nicoliveProgramStateService.state.nameplateEnabled;
  }
  set nameplateEnabled(e: boolean) {
    this.nicoliveProgramStateService.updateNameplateEnabled(e);
  }

  get showAnonymous() {
    return this.nicoliveCommentLocalFilterService.showAnonymous;
  }

  set showAnonymous(v: boolean) {
    this.nicoliveCommentLocalFilterService.showAnonymous = v;
  }

  useOneComme = false;
  removeComment = true;
  isOneCommeError = false;

  initOneComme() {
    this.useOneComme = this.nicoliveProgramStateService.state.onecommeRelation.use;
    this.removeComment = this.nicoliveProgramStateService.state.onecommeRelation.removeComment;
  }

  @Watch('useOneComme')
  async onUseOneCommeChanged() {
    const use = this.useOneComme;
    this.isOneCommeError = false;
    if (use === this.nicoliveProgramStateService.state.onecommeRelation.use) return;
    if (use) {
      if (!(await this.nicoliveProgramService.oneCommeRelation.testConnection())) {
        this.isOneCommeError = true;
      }
    }
    this.nicoliveProgramStateService.updateOneCommeRelation({ use });
    if (use) this.nicoliveProgramService.oneCommeRelation.update({ force: true });
  }

  @Watch('removeComment')
  onRemoveCommentChanged() {
    const removeComment = this.removeComment;
    this.nicoliveProgramStateService.updateOneCommeRelation({ removeComment });
  }

  showOneCommeInfo() {
    remote.shell.openExternal('https://onecomme.com/docs/about');
  }

  httpRelationMethods: MethodObject[] = [
    { value: '', text: '---' },
    { value: 'GET', text: 'GET' },
    { value: 'POST', text: 'POST' },
    { value: 'PUT', text: 'PUT' },
  ];

  get httpRelationMethod(): MethodObject {
    const value = this.nicoliveProgramStateService.state.httpRelation.method;
    const obj = this.httpRelationMethods.find((a) => a.value === value);
    return obj ?? this.httpRelationMethods[0];
  }
  set httpRelationMethod(method: MethodObject) {
    this.nicoliveProgramStateService.updateHttpRelation({ method: method.value });
  }
  get httpRelationUrl(): string {
    return this.nicoliveProgramStateService.state.httpRelation.url;
  }
  set httpRelationUrl(url: string) {
    this.nicoliveProgramStateService.updateHttpRelation({ url });
  }
  get httpRelationBody(): string {
    return this.nicoliveProgramStateService.state.httpRelation.body;
  }
  set httpRelationBody(body: string) {
    this.nicoliveProgramStateService.updateHttpRelation({ body });
  }

  testHttpRelation() {
    HttpRelation.sendTest(this.nicoliveProgramStateService.state.httpRelation).then();
  }

  showHttpRelationPage() {
    remote.shell.openExternal('https://github.com/n-air-app/n-air-app/wiki/http_relation');
  }
}
