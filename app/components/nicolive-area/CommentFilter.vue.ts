import Popper from 'components/shared/Popper.vue';
import { NicoliveCommentFilterService } from 'services/nicolive-program/nicolive-comment-filter';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { FilterRecord, FilterType } from 'services/nicolive-program/ResponseTypes';
import { defineComponent } from 'vue';

function isHash(item: FilterRecord): boolean {
  if (item.type !== 'user') return false;
  return item.isHashed || false;
}

function getBody(item: FilterRecord): string {
  if (item.type === 'user') {
    return `ID: ${isHash(item) ? '******** (匿名)' : item.body}`;
  } else {
    return item.body;
  }
}

type FilterByUser = 'all' | 'broadcaster' | 'moderator';

export default defineComponent({
  name: 'CommentFilter',

  components: { Popper },

  data() {
    return {
      showPopupMenu: false,
      adjusterTooltip: '登録者で絞り込み',
      deleting: false,
      currentType: 'word' as FilterType,
      currentFilterBy: 'all' as FilterByUser,
      newFilterValue: '',
      adding: false,
    };
  },

  computed: {
    FILTER_VALUE(): { word: string; user: string; command: string } {
      return {
        word: 'コメント',
        user: 'ユーザーID',
        command: 'コマンド',
      };
    },

    PLACEHOLDER(): { word: string; user: string; command: string } {
      return {
        word: 'コメントを入力',
        user: 'ユーザーIDを入力 (例:12345678)',
        command: 'コマンドを入力',
      };
    },

    isEmptyBecauseOfFilterBy(): boolean {
      return this.currentTypeFilters.length === 0 && this.currentFilterBy !== 'all';
    },

    numberOfEntries() {
      return this.currentTypeFilters.length;
    },

    currentFilterName() {
      switch (this.currentFilterBy) {
        case 'broadcaster':
          return '放送者による';
        case 'moderator':
          return 'モデレーターによる';
        default:
          return '';
      }
    },

    count() {
      return this.filters.length;
    },

    maxCount() {
      return 500;
    },

    invalid(): boolean {
      if (this.newFilterValue === '') return false;
      if (this.currentType === 'user') {
        return !this.newFilterValue.match(/^[1-9][0-9]*$/);
      }
      return false;
    },

    filters() {
      return NicoliveCommentFilterService.instance().filters;
    },

    currentTypeFilters() {
      const isBroadcaster = (x: FilterRecord) =>
        NicoliveCommentFilterService.instance().isBroadcastersFilter(x);
      const filtersBy: (x: FilterRecord) => boolean = {
        all: () => true,
        broadcaster: isBroadcaster,
        moderator: (x: FilterRecord) => !isBroadcaster(x),
      }[this.currentFilterBy as FilterByUser];

      return this.filters
        .filter((x: FilterRecord) => x.type === this.currentType)
        .filter((x: FilterRecord) => filtersBy(x))
        .map((item: FilterRecord) => {
          return {
            id: item.id,
            type: item.type,
            body: getBody(item),
            register_date: `登録日時: ${new Date(item.createdAt).toLocaleString()}`,
            comment_body: item.memo && `コメント: ${item.memo}`,
            ...(isBroadcaster(item) ? {} : { register_by: `登録者名: ${item.userName}` }),
          };
        });
    },
  },

  watch: {
    currentType() {
      this.newFilterValue = '';
    },
  },

  mounted() {
    this.reloadFilters();
  },

  methods: {
    async reloadFilters() {
      try {
        return NicoliveCommentFilterService.instance().fetchFilters();
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          throw caught;
        }
      }
    },

    async deleteFilter(record: FilterRecord) {
      try {
        this.deleting = true;
        await NicoliveCommentFilterService.instance().deleteFilters([record.id]);
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          throw caught;
        }
      } finally {
        this.deleting = false;
      }
    },

    async onAdd() {
      const body = this.newFilterValue;
      if (body.length === 0) return;

      try {
        this.adding = true;
        await NicoliveCommentFilterService.instance().addFilter({
          type: this.currentType,
          body,
        });
        this.newFilterValue = '';
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          throw caught;
        }
      } finally {
        this.adding = false;

        this.$nextTick(() => {
          (this.$refs.input as HTMLElement)?.focus();
        });
      }
    },

    close() {
      this.$emit('close');
    },
  },
});

