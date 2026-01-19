import AppearanceSettings from 'components/AppearanceSettings.vue';
import ExperimentalSettings from 'components/ExperimentalSettings.vue';
import LanguageSettings from 'components/LanguageSettings.vue';
import NotificationsSettings from 'components/NotificationsSettings.vue';
import GenericFormGroups from 'components/obs/inputs/GenericFormGroups.vue';
import SubStreamSettings from 'components/SubStreamSettings.vue';
import { Subscription } from 'rxjs';
import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';
import { Inject } from '../../services/core/injector';
import { CustomizationService } from '../../services/customization';
import {
  ISettingsServiceApi,
  ISettingsSubCategory,
  SettingsCategory,
} from '../../services/settings';
import { StreamingService } from '../../services/streaming';
import { UserService } from '../../services/user';
import { WindowsService } from '../../services/windows';
import CommentSettings from '../CommentSettings.vue';
import ExtraSettings from '../ExtraSettings.vue';
import Hotkeys from '../Hotkeys.vue';
import ModalLayout from '../ModalLayout.vue';
import NavItem from '../shared/NavItem.vue';
import NavMenu from '../shared/NavMenu.vue';
import SpeechEngineSettings from '../SpeechEngineSettings.vue';
import TableOfContents from '../shared/TableOfContents.vue';
import { TocManager } from '../shared/TocManager';
import TocSection from '../shared/TocSection.vue';
import TranscriptionSettings from '../TranscriptionSettings.vue';
import { CategoryIcons } from './CategoryIcons';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

@Component({
  components: {
    ModalLayout,
    GenericFormGroups,
    NavMenu,
    NavItem,
    ExtraSettings,
    Hotkeys,
    NotificationsSettings,
    AppearanceSettings,
    ExperimentalSettings,
    LanguageSettings,
    CommentSettings,
    SpeechEngineSettings,
    SubStreamSettings,
    TranscriptionSettings,
    TableOfContents,
    TocSection,
  },
  provide(this: Settings) {
    return {
      getTocSectionId: (): string => {
        return this.tocManager.generateId();
      },
      registerTocSection: (section: TocSectionData) => {
        this.tocManager.register(this.categoryName, section);
      },
      unregisterTocSection: (sectionId: string) => {
        this.tocManager.unregister(this.categoryName, sectionId);
      },
    };
  },
})
export default class Settings extends Vue {
  @Inject() settingsService: ISettingsServiceApi;
  @Inject() windowsService: WindowsService;
  @Inject() userService: UserService;
  @Inject() customizationService: CustomizationService;
  @Inject() streamingService: StreamingService;

  $refs: { settingsContainer: HTMLElement };

  categoryName: SettingsCategory = 'General';
  settingsData: ISettingsSubCategory[] = [];
  // @ts-expect-error: ts2729: use before initialization
  categoryNames = this.settingsService.getCategories();
  userSubscription: Subscription;
  icons = CategoryIcons;
  isLoggedIn = false;

  // TOC管理
  private tocManager = new TocManager();

  // 現在のカテゴリのセクションリストを取得
  get currentSections(): TocSectionData[] {
    return this.tocManager.getSections(this.categoryName);
  }

  mounted() {
    // Categories depend on whether the user is logged in or not.
    // When they depend another state, it's time to refine this implementation.
    this.userSubscription = this.userService.userLoginState.subscribe(loggedIn => {
      this.isLoggedIn = !!loggedIn;
      this.categoryNames = this.settingsService.getCategories();
      // reopen settings because new categories may not have previous category
      this.settingsService.showSettings();
    });
    this.isLoggedIn = this.userService.isLoggedIn();

    this.categoryName = this.getInitialCategoryName();
    this.settingsData = this.settingsService.getSettingsFormData(this.categoryName);
  }

  beforeDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  get isStreaming() {
    return this.streamingService.isStreaming;
  }

  getInitialCategoryName() {
    if (this.windowsService.state.child.queryParams) {
      return this.windowsService.state.child.queryParams.categoryName || 'General';
    }
    return 'General';
  }

  save(settingsData: ISettingsSubCategory[]) {
    this.settingsService.setSettings(this.categoryName, settingsData);
    this.settingsData = this.settingsService.getSettingsFormData(this.categoryName);
  }

  done() {
    this.windowsService.closeChildWindow();
  }

  @Watch('categoryName')
  onCategoryNameChangedHandler(categoryName: SettingsCategory) {
    this.settingsData = this.settingsService.getSettingsFormData(categoryName);
    this.$refs.settingsContainer.scrollTop = 0;
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element && this.$refs.settingsContainer) {
      const container = this.$refs.settingsContainer;
      const containerTop = container.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const offset = elementTop - containerTop - 16; // 16px padding

      container.scrollTo({
        top: container.scrollTop + offset,
        behavior: 'smooth',
      });
    }
  }
}
