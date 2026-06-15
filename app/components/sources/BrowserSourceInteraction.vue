<template>
  <ModalLayout :showControls="false" :contentStyles="{ padding: '0px' }">
    <template #content>
      <div
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
    </template>
  </ModalLayout>
</template>

<script lang="ts" src="./BrowserSourceInteraction.vue.ts"></script>
