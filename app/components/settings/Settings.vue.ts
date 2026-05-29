import GenericFormGroups from 'components/obs/inputs/GenericFormGroups.vue';
import { CategoryIcons } from 'components/settings/CategoryIcons';
import CommentSettings from 'components/settings/CommentSettings.vue';
import CommentSpeechSettings from 'components/settings/CommentSpeechSettings.vue';
import ExtraSettings from 'components/settings/ExtraSettings.vue';
import Hotkeys from 'components/settings/Hotkeys.vue';
import LanguageSettings from 'components/settings/LanguageSettings.vue';
import SubStreamSettings from 'components/settings/SubStreamSettings.vue';
import TranscriptionSettings from 'components/settings/TranscriptionSettings.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import NavItem from 'components/shared/NavItem.vue';
import NavMenu from 'components/shared/NavMenu.vue';
import TableOfContents from 'components/shared/TableOfContents.vue';
import { TocManager } from 'components/shared/TocManager';
import TocSection from 'components/shared/TocSection.vue';
import { Subscription } from 'rxjs';
import {
  ISettingsServiceApi,
  ISettingsSubCategory,
  SettingsCategory,
} from 'services/settings';
import { StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

// 目次を持っているカテゴリ
const CATEGORIES_WITH_TOC: string[] = [
  'Hotkeys',
  'Advanced',
  'Comment',
  'CommentSpeech',
];

// ニコニコログインが必要なカテゴリ
const CATEGORIES_REQUIRING_LOGIN: SettingsCategory[] = ['Comment', 'CommentSpeech'];

export default defineComponent({
  name: 'Settings',
  components: {
    ModalLayout,
    GenericFormGroups,
    NavMenu,
    NavItem,
    ExtraSettings,
    Hotkeys,
    LanguageSettings,
    CommentSettings,
    CommentSpeechSettings,
    SubStreamSettings,
    TranscriptionSettings,
    TableOfContents,
    TocSection,
  },
  provide() {
    return {
      getTocSectionId: (): string => {
        return this.tocManager.generateId();
      },
      registerTocSection: (section: TocSectionData): string => {
        const categoryName = this.categoryName;
        this.tocManager.register(categoryName, section);
        return categoryName;
      },
      unregisterTocSection: (categoryName: string, sectionId: string) => {
        this.tocManager.unregister(categoryName, sectionId);
      },
    };
  },
  data() {
    return {
      categoryName: null as SettingsCategory | null,
      settingsData: [] as ISettingsSubCategory[],
      categoryNames: (require('services/settings').SettingsService.instance() as ISettingsServiceApi).getCategories(),
      userSubscription: null as Subscription | null,
      icons: CategoryIcons,
      isLoggedIn: false,
      isTocOpen: true,
      currentActiveTocId: null as string | null,
      tocManager: new TocManager(),
    };
  },
  computed: {
    isStreaming(): boolean {
      return StreamingService.instance().isStreaming;
    },
    showLoginRequiredNotice(): boolean {
      return (
        !this.isLoggedIn
        && CATEGORIES_REQUIRING_LOGIN.includes(this.categoryName)
      );
    },
    currentSections(): TocSectionData[] {
      if (!this.categoryName) return [];
      return this.tocManager.getSections(this.categoryName);
    },
  },
  watch: {
    categoryName(categoryName: SettingsCategory) {
      this.settingsData = (require('services/settings').SettingsService.instance() as ISettingsServiceApi).getSettingsFormData(categoryName);
      (this.$refs.settingsContainer as HTMLElement).scrollTop = 0;
      this.isTocOpen = true;

      this.tocManager.clear(categoryName);

      this.currentActiveTocId = null;

      this.$nextTick(() => {
        this.$nextTick(() => {
          const sections = this.tocManager.getSections(categoryName);
          if (sections && sections.length > 0) {
            this.currentActiveTocId = sections[0].id;
          }
        });
      });
    },
  },
  mounted() {
    this.userSubscription = UserService.instance().userLoginState.subscribe((loggedIn) => {
      this.isLoggedIn = !!loggedIn;
      this.categoryNames = (require('services/settings').SettingsService.instance() as ISettingsServiceApi).getCategories();
    });
    this.isLoggedIn = UserService.instance().isLoggedIn();

    const initialCategory = this.getInitialCategoryName();
    this.tocManager.clearAll();
    this.categoryName = initialCategory;
    this.settingsData = (require('services/settings').SettingsService.instance() as ISettingsServiceApi).getSettingsFormData(this.categoryName);
    const anchor = this.getInitialAnchor();
    if (anchor) {
      this.$nextTick(() => {
        const element = document.querySelector(anchor);
        if (element) {
          element.scrollIntoView();
        }
      });
    }
  },
  beforeUnmount() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  },
  methods: {
    handleCategoryClick(category: SettingsCategory) {
      if (this.categoryName === category) {
        this.isTocOpen = !this.isTocOpen;
      } else {
        this.categoryName = category;
      }
    },
    getInitialCategoryName(): SettingsCategory {
      const queryParams = WindowsService.instance().state.child.queryParams;
      return queryParams?.categoryName || 'General';
    },
    getInitialAnchor(): string {
      const anchor = WindowsService.instance().state.child.anchor;
      return anchor || undefined;
    },
    save(settingsData: ISettingsSubCategory[]) {
      (require('services/settings').SettingsService.instance() as ISettingsServiceApi).setSettings(this.categoryName, settingsData);
      this.settingsData = (require('services/settings').SettingsService.instance() as ISettingsServiceApi).getSettingsFormData(this.categoryName);
    },
    done() {
      WindowsService.instance().closeChildWindow();
    },
    scrollToSection(sectionId: string) {
      const element = document.getElementById(sectionId);
      if (element && this.$refs.settingsContainer) {
        const container = this.$refs.settingsContainer as HTMLElement;
        const containerTop = container.getBoundingClientRect().top;
        const elementTop = element.getBoundingClientRect().top;
        const offset = elementTop - containerTop - 16;

        container.scrollTo({
          top: container.scrollTop + offset,
          behavior: 'smooth',
        });
      }
    },
    handleTocNavigate(sectionId: string) {
      this.currentActiveTocId = sectionId;
      this.scrollToSection(sectionId);
    },
    hasSections(category: SettingsCategory): boolean {
      if (!this.isLoggedIn && CATEGORIES_REQUIRING_LOGIN.includes(category)) {
        return false;
      }
      return CATEGORIES_WITH_TOC.includes(category);
    },
  },
});
