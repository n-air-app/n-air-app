import * as remote from '@electron/remote';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { apply as applyAutoLink } from 'util/autoLink';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ProgramDescription',

  computed: {
    programDescription(): string {
      return applyAutoLink(NicoliveProgramService.instance.state.description);
    },
  },

  methods: {
    /**
     * 番組詳細のリンクを既定のブラウザで開く
     * anchor要素は自動リンクによってしか生成されないので、anchor要素の子はテキストノードのみ
     **/
    handleAnchorClick(event: MouseEvent): void {
      if (!(event.target instanceof HTMLAnchorElement)) return;

      event.preventDefault();
      const url = event.target.href;
      try {
        const parsed = new URL(url);
        if (parsed.protocol.match(/https?/)) {
          remote.shell.openExternal(parsed.href);
        }
      } catch (e) {
        console.error(e);
      }
    },
  },
});
