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
import { Inject } from 'services/core/injector';
import {
  ISettingsServiceApi,
  ISettingsSubCategory,
  SettingsCategory,
} from 'services/settings';
import { StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { WindowsService } from 'services/windows';
import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';

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

@Component({
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
  provide(this: Settings) {
    return {
      getTocSectionId: (): string => {
        return this.tocManager.generateId();
      },
      registerTocSection: (section: TocSectionData): string => {
        const categoryName = this.categoryName;
        this.tocManager.register(categoryName, section);
        return categoryName; // Return the category name so TocSection can remember it
      },
      unregisterTocSection: (categoryName: string, sectionId: string) => {
        this.tocManager.unregister(categoryName, sectionId);
      },
    };
  },
})
export default class Settings extends Vue {
  @Inject() settingsService: ISettingsServiceApi;
  @Inject() windowsService: WindowsService;
  @Inject() userService: UserService;
  @Inject() streamingService: StreamingService;

  $refs: { settingsContainer: HTMLElement };

  categoryName: SettingsCategory | null = null;
  settingsData: ISettingsSubCategory[] = [];
  // @ts-expect-error: ts2729: use before initialization
  categoryNames = this.settingsService.getCategories();
  userSubscription: Subscription;
  icons = CategoryIcons;
  isLoggedIn = false;

  // TOCの開閉状態を管理するプロパティを追加
  public isTocOpen: boolean = true;
  public currentActiveTocId: string | null = null;

  // NavItemのクリック時に呼び出すメソッド
  public handleCategoryClick(category: SettingsCategory) {
    if (this.categoryName === category) {
      this.isTocOpen = !this.isTocOpen;
    } else {
      this.categoryName = category;
    }
  }

  // TOC管理
  private tocManager = new TocManager();

  // 現在のカテゴリのセクションリストを取得
  get currentSections(): TocSectionData[] {
    if (!this.categoryName) return [];
    return this.tocManager.getSections(this.categoryName);
  }

  mounted() {
    // Categories depend on whether the user is logged in or not.
    // When they depend another state, it's time to refine this implementation.
    this.userSubscription = this.userService.userLoginState.subscribe((loggedIn) => {
      this.isLoggedIn = !!loggedIn;
      this.categoryNames = this.settingsService.getCategories();
    });
    this.isLoggedIn = this.userService.isLoggedIn();

    // Initialize category and TOC before setting categoryName to avoid cross-category TOC contamination
    const initialCategory = this.getInitialCategoryName();
    this.tocManager.clearAll(); // Clear all categories to start fresh
    this.categoryName = initialCategory;
    this.settingsData = this.settingsService.getSettingsFormData(this.categoryName);
    // scroll to the anchor if it exists
    const anchor = this.getInitialAnchor();
    if (anchor) {
      this.$nextTick(() => {
        const element = document.querySelector(anchor);
        if (element) {
          element.scrollIntoView();
        }
      });
    }
  }

  beforeDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  get isStreaming() {
    return this.streamingService.isStreaming;
  }

  get showLoginRequiredNotice(): boolean {
    return (
      !this.isLoggedIn
      && CATEGORIES_REQUIRING_LOGIN.includes(this.categoryName)
    );
  }

  getInitialCategoryName(): SettingsCategory {
    const queryParams = this.windowsService.state.child.queryParams;
    return queryParams?.categoryName || 'General';
  }

  getInitialAnchor(): string {
    const anchor = this.windowsService.state.child.anchor;
    return anchor || undefined;
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
    this.isTocOpen = true;

    // Clear TOC sections for the current category to prevent duplicates on re-selection
    // This ensures a clean slate when switching tabs or re-selecting the same tab
    this.tocManager.clear(categoryName);

    this.currentActiveTocId = null;

    this.$nextTick(() => {
      this.$nextTick(() => {
        const sections = this.tocManager.getSections(categoryName);
        if (sections && sections.length > 0) {
          // 先頭の目次をアクティブにする
          this.currentActiveTocId = sections[0].id;
        }
      });
    });
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

  public handleTocNavigate(sectionId: string) {
    this.currentActiveTocId = sectionId; // ハイライトを切り替える
    this.scrollToSection(sectionId); // すでにあるスクロール関数を呼ぶ
  }

  public hasSections(category: SettingsCategory): boolean {
    if (!this.isLoggedIn && CATEGORIES_REQUIRING_LOGIN.includes(category)) {
      return false;
    }
    return CATEGORIES_WITH_TOC.includes(category);
  }
}
