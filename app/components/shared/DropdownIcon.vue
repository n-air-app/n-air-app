<template>
  <dropdown
    :value="value"
    @input="$emit('input', $event)"
    :options="options"
    label="name"
    track-by="id"
    :disabled="disabled"
    :loading="loading"
    :searchable="searchable"
  >
    <template #singleLabel="p">
      <div class="voption">
        <img :src="p.option.icon" alt="" />
        <span>{{ p.option.name }}</span>
      </div>
    </template>
    <template #option="p">
      <div class="voption">
        <img :src="p.option.icon" alt="" />
        <span>{{ p.option.name }}</span>
      </div>
    </template>
  </dropdown>
</template>

<script lang="ts" src="./DropdownIcon.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.voption {
  display: flex;
  align-items: center;

  img {
    height: 24px;
    margin-right: 8px;
  }
}

:deep(.dropdown__single) {
  .voption span {
    height: 100%;
    .text-ellipsis();
  }
}
</style>
