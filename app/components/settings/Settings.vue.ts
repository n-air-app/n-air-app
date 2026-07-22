import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';
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
import { $t } from 'services/i18n';
import { ScenesService } from 'services/scenes';
import {
  ISettingsSubCategory,
  SettingsCategory,
  SettingsService,
} from 'services/settings';
import { StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { WindowsService } from 'services/windows';
import { defineComponent, toRaw } from 'vue';

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

// 'Base'/'Output' の解像度設定値('WIDTHxHEIGHT'形式)をパースする。不正な形式ならnull
function parseResolution(value: string): IVec2 | null {
  const [width, height] = value.split('x').map(Number);
  if (!width || !height) return null;
  return { x: width, y: height };
}

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
      categoryNames: SettingsService.instance().getCategories(),
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
      this.settingsData = SettingsService.instance().getSettingsFormData(categoryName);
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
      this.categoryNames = SettingsService.instance().getCategories();
    });
    this.isLoggedIn = UserService.instance().isLoggedIn();

    const initialCategory = this.getInitialCategoryName();
    this.tocManager.clearAll();
    this.categoryName = initialCategory;
    this.settingsData = SettingsService.instance().getSettingsFormData(this.categoryName);
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
    async save(settingsData: ISettingsSubCategory[]) {
      // Vue 3 の reactive proxy を剥がしてから IPC 経由の OBS API に渡す
      function deepToRaw(val: any): any {
        const raw = toRaw(val);
        if (raw === null || typeof raw !== 'object') return raw;
        if (Array.isArray(raw)) return raw.map(deepToRaw);
        const result: any = {};
        for (const key of Object.keys(raw)) {
          result[key] = deepToRaw(raw[key]);
        }
        return result;
      }

      const settingsService = SettingsService.instance();
      const category = this.categoryName;

      // キャンバス解像度(Base)を変更しようとしているかどうかを保存前に確認しておく
      let baseResolutionChange: { old: IVec2; new: IVec2 } | null = null;
      if (category === 'Video') {
        const oldBase = settingsService.findSettingValue(this.settingsData, 'Untitled', 'Base') as string;
        const newBase = settingsService.findSettingValue(settingsData, 'Untitled', 'Base') as string;
        if (oldBase && newBase && oldBase !== newBase) {
          const oldSize = parseResolution(oldBase);
          const newSize = parseResolution(newBase);
          if (oldSize && newSize) {
            baseResolutionChange = { old: oldSize, new: newSize };
          }
        }
      }

      let rescale = false;
      if (baseResolutionChange) {
        const choice = await this.confirmRescaleSceneItems(
          `${baseResolutionChange.old.x}x${baseResolutionChange.old.y}`,
          `${baseResolutionChange.new.x}x${baseResolutionChange.new.y}`,
        );
        if (choice === 'cancel') {
          // キャンバス解像度の変更自体を取りやめる。表示を保存前の値に戻す
          this.settingsData = settingsService.getSettingsFormData(category);
          return;
        }
        rescale = choice === 'yes';
      }

      settingsService.setSettings(category, deepToRaw(settingsData));
      this.settingsData = settingsService.getSettingsFormData(category);

      if (rescale) {
        const { old: oldSize, new: newSize } = baseResolutionChange;
        try {
          ScenesService.instance().rescaleAllScenes(newSize.x / oldSize.x, newSize.y / oldSize.y);
        } catch (e: unknown) {
          // キャンバス解像度は既に変更済みのため、失敗してもロールバックはしない。
          // 一部のシーンアイテムだけリスケールされた状態になり得るのでユーザーに知らせる
          Sentry.captureException(e);
          remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), {
            type: 'error',
            message: $t('settings.rescaleSceneItemsFailed'),
          });
        }
      }
    },
    /**
     * キャンバス解像度(Base)の変更前に、既存シーンのレイアウトを維持するため
     * 全シーンアイテムを新しい解像度に合わせて拡大／縮小するかどうかを確認する。
     * 'yes' = 拡大／縮小する, 'no' = 変更のみ行う(レイアウトは左上に詰まる), 'cancel' = 解像度変更自体を取りやめる
     */
    async confirmRescaleSceneItems(oldBase: string, newBase: string): Promise<'yes' | 'no' | 'cancel'> {
      const { response } = await remote.dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'question',
        buttons: [$t('common.yes'), $t('common.no'), $t('common.cancel')],
        title: $t('common.confirm'),
        message: $t('settings.rescaleSceneItemsConfirm', { oldBase, newBase }),
        noLink: true,
        cancelId: 2,
        defaultId: 2,
      });
      return (['yes', 'no', 'cancel'] as const)[response];
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
