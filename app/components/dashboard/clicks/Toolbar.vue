<script setup lang="ts">
import type { ClickRangePreset, ClickTriState } from '@/composables/clicks'
import { Download, RefreshCw } from '@lucide/vue'
import { toast } from 'vue-sonner'

const store = useDashboardClicksStore()
const { t } = useI18n()
const { isAdmin } = useDashboardSession()
const exporting = shallowRef(false)

const presets: ClickRangePreset[] = ['today', '7d', '30d', '90d', '180d']
const triStates: ClickTriState[] = ['exclude', 'include', 'only']

async function exportCsv() {
  exporting.value = true
  try {
    const blob = await useAPI<Blob>('/api/clicks/export', { query: store.query, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `clicks-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  catch {
    toast.error(t('clicks.export_failed'))
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <NativeSelect v-model="store.preset" size="sm" :aria-label="$t('clicks.range.label')">
      <NativeSelectOption v-for="preset in presets" :key="preset" :value="preset">
        {{ $t(`clicks.range.${preset}`) }}
      </NativeSelectOption>
    </NativeSelect>
    <NativeSelect v-model="store.bots" size="sm" :aria-label="$t('clicks.toggles.bots')">
      <NativeSelectOption v-for="state in triStates" :key="state" :value="state">
        {{ $t('clicks.toggles.bots') }}: {{ $t(`clicks.toggles.${state}`) }}
      </NativeSelectOption>
    </NativeSelect>
    <NativeSelect v-model="store.known" size="sm" :aria-label="$t('clicks.toggles.known')">
      <NativeSelectOption v-for="state in triStates" :key="state" :value="state">
        {{ $t('clicks.toggles.known') }}: {{ $t(`clicks.toggles.${state}`) }}
      </NativeSelectOption>
    </NativeSelect>
    <Button variant="outline" size="sm" :aria-label="$t('common.try_again')" @click="store.refresh()">
      <RefreshCw aria-hidden="true" class="size-4" />
    </Button>
    <Button v-if="isAdmin" variant="outline" size="sm" :disabled="exporting" @click="exportCsv">
      <Download aria-hidden="true" class="size-4" />
      {{ $t('clicks.export') }}
    </Button>
  </div>
</template>
