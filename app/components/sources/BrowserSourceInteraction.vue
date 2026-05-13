<template>
  <ModalLayout :showControls="false" :contentStyles="{ padding: '0px' }">
    <div
      slot="content"
      @wheel="onWheel"
      @mousedown="onMousedown"
      @mouseup="onMouseup"
      @mousemove="onMousemove"
      @keydown="onKeydown"
      @keyup="onKeyup"
      tabindex="0"
      style="height: 100%; outline: none"
      ref="eventDiv"
    >
      <Display :sourceId="sourceId" @outputResize="onOutputResize" />
    </div>
  </ModalLayout>
</template>

<script lang="ts" src="./BrowserSourceInteraction.vue.ts"></script>
