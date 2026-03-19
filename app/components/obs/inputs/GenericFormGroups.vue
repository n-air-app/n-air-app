<template>
  <div class="form-groups">
    <template v-for="(formGroup, groupIndex) in value">
      <component
        v-if="hasAnyVisibleSettings(formGroup)"
        :key="(formGroup.nameSubCategory === 'Untitled' ? 'untitled-' : '') + formGroup.nameSubCategory + groupIndex"
        :is="isSimpleCategory ? 'div' : 'toc-section'"
        :title="isSimpleCategory ? undefined :
          formGroup.nameSubCategory === 'Untitled'
            ? getUntitledSectionTitle(formGroup)
            : $t(`settings.${category}['${formGroup.nameSubCategory}'].name`, {
              fallback: formGroup.nameSubCategory,
            })"
      >
        <div class="section">
          <aside class="notification-root" v-if="category === 'Stream'">
            <i class="notification-icon icon-notification" />
            <p class="notification-message">
              <i18n path="settings.noticeForStreaming" v-if="isLoggedIn">
                <br place="br" />
              </i18n>
              <i18n path="settings.noticeForStreamingNotLoggedIn" v-else>
                <br place="br" />
              </i18n>
            </p>
          </aside>

          <div class="section-title--dropdown" v-if="formGroup.nameSubCategory !== 'Untitled'">
            <h4 class="section-title" @click="toggleGroup(groupIndex)">
              <i class="icon-plus" v-show="collapsedGroups[groupIndex]"></i>
              <i class="icon-minus" v-show="!collapsedGroups[groupIndex]"></i>
              {{
                $t(`settings.${category}['${formGroup.nameSubCategory}'].name`, {
                  fallback: formGroup.nameSubCategory,
                })
              }}
            </h4>
          </div>

          <div
            :class="formGroup.nameSubCategory === 'Untitled' ? 'section-content' : 'section-content section-content--dropdown'"
            v-if="formGroup.nameSubCategory === 'Untitled' || !collapsedGroups[groupIndex]"
          >
            <GenericForm
              v-model="formGroup.parameters"
              @input="onInputHandler"
              :category="category"
              :subCategory="formGroup.nameSubCategory"
            ></GenericForm>
          </div>
        </div>
      </component>
    </template>
  </div>
</template>

<script lang="ts" src="./GenericFormGroups.vue.ts"></script>

<style lang="less">
.form-groups {
  .section {
    &:last-child {
      border-bottom: none;
    }
  }
}
</style>
