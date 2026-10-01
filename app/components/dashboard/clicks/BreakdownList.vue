<script setup lang="ts">
import type { ClickDimension } from '#shared/schemas/click'
import type { ClickBreakdownRow } from '@/composables/clicks'

const props = defineProps<{
  dimension: ClickDimension
}>()

const store = useDashboardClicksStore()
const { t } = useI18n()
const rows = ref<ClickBreakdownRow[]>([])
const loading = shallowRef(true)

const isTime = computed(() => ['hour', 'weekday', 'day'].includes(props.dimension))

watch([() => store.query, () => props.dimension], async ([query], _old, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  loading.value = true
  try {
    const result = await useAPI<{ data: ClickBreakdownRow[] }>('/api/clicks/breakdown', {
      query: { ...query, dimension: props.dimension, limit: props.dimension === 'day' ? 200 : 100 },
      signal: controller.signal,
    })
    if (!controller.signal.aborted)
      rows.value = result.data
  }
  catch {
    if (!controller.signal.aborted)
      rows.value = []
  }
  finally {
    if (!controller.signal.aborted)
      loading.value = false
  }
}, { immediate: true })

const max = computed(() => Math.max(1, ...rows.value.map(row => row.clicks)))

function label(value: ClickBreakdownRow['value']) {
  if (value === null || value === '')
    return t('clicks.breakdown.none')
  if (props.dimension === 'weekday')
    return t(`clicks.weekdays.${value}`)
  if (props.dimension === 'hour')
    return `${String(value).padStart(2, '0')}:00`
  return String(value)
}

function select(value: ClickBreakdownRow['value']) {
  if (isTime.value)
    return
  store.setFilter(props.dimension, value === null || value === '' ? '(none)' : String(value))
}
</script>

<template>
  <div class="h-full overflow-auto">
    <Table class="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>{{ $t('clicks.breakdown.value') }}</TableHead>
          <TableHead class="w-16 text-right">
            {{ $t('clicks.breakdown.clicks') }}
          </TableHead>
          <TableHead class="w-16 text-right">
            {{ $t('clicks.breakdown.visitors') }}
          </TableHead>
          <TableHead class="w-12 text-right">
            {{ $t('clicks.breakdown.ips') }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmpty v-if="!loading && rows.length === 0" :colspan="4">
          {{ $t('clicks.breakdown.empty') }}
        </TableEmpty>
        <TableRow
          v-for="row in rows"
          :key="String(row.value)"
          :class="isTime ? '' : 'cursor-pointer'"
          @click="select(row.value)"
        >
          <TableCell class="relative">
            <div
              class="absolute inset-y-1 left-0 rounded-r bg-primary/10"
              :style="{ width: `${(row.clicks / max) * 100}%` }"
              aria-hidden="true"
            />
            <div class="relative truncate" :title="label(row.value)">
              {{ label(row.value) }}
            </div>
          </TableCell>
          <TableCell class="text-right tabular-nums">
            {{ row.clicks }}
          </TableCell>
          <TableCell class="text-right text-muted-foreground tabular-nums">
            {{ row.visitors }}
          </TableCell>
          <TableCell class="text-right text-muted-foreground tabular-nums">
            {{ row.ips }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
