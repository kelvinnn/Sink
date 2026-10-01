<script setup lang="ts">
// Fork: dialog wrapper for the lock form.
const props = defineProps<{
  slug: string
  linkId: string
}>()

const open = defineModel<boolean>('open', { default: false })
const formId = computed(() => `link-lock-form-${props.linkId}`)
const { refresh } = useLinkMeta()

function onLocked() {
  open.value = false
  refresh(props.linkId)
}
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    :title="$t('admin.lock.title', { slug })"
    :description="$t('admin.lock.description')"
    content-class="md:max-w-md"
  >
    <DashboardLinksLockForm v-if="open" :slug="slug" :form-id="formId" @locked="onLocked" />
    <template #footer>
      <Button type="submit" :form="formId">
        {{ $t('admin.meta.locked') }}
      </Button>
    </template>
  </ResponsiveModal>
</template>
