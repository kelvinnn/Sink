<script setup lang="ts">
import { Plus } from '@lucide/vue'

const emit = defineEmits<{
  created: []
}>()

const open = shallowRef(false)
const formId = 'known-ip-create-form'

function onCreated() {
  open.value = false
  emit('created')
}
</script>

<template>
  <ResponsiveModal v-model:open="open" :title="$t('known_ips.add')" :description="$t('known_ips.description')" content-class="md:max-w-lg">
    <template #trigger>
      <Button size="sm">
        <Plus aria-hidden="true" class="size-4" />
        {{ $t('known_ips.add') }}
      </Button>
    </template>
    <DashboardKnownIpsCreateForm v-if="open" :form-id="formId" @created="onCreated" />
    <template #footer>
      <Button type="submit" :form="formId">
        {{ $t('common.save') }}
      </Button>
    </template>
  </ResponsiveModal>
</template>
