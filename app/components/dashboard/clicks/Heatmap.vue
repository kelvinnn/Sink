<script setup lang="ts">
interface HeatmapPoint {
  weekday: number
  hour: number
  clicks: number
  visitors: number
}

const store = useDashboardClicksStore()
const { t } = useI18n()
const points = ref<HeatmapPoint[]>([])

watch(() => store.query, async (query, _old, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  try {
    const result = await useAPI<{ data: HeatmapPoint[] }>('/api/clicks/heatmap', { query, signal: controller.signal })
    if (!controller.signal.aborted)
      points.value = result.data
  }
  catch {
    if (!controller.signal.aborted)
      points.value = []
  }
}, { immediate: true })

// Monday-first rows, 24 hour columns.
const weekdays = [1, 2, 3, 4, 5, 6, 0]
const hours = Array.from({ length: 24 }, (_, hour) => hour)

const grid = computed(() => {
  const map = new Map(points.value.map(point => [`${point.weekday}-${point.hour}`, point]))
  return weekdays.map(weekday => hours.map(hour => map.get(`${weekday}-${hour}`) ?? { weekday, hour, clicks: 0, visitors: 0 }))
})
const max = computed(() => Math.max(1, ...points.value.map(point => point.clicks)))

function cellStyle(clicks: number) {
  if (!clicks)
    return {}
  const strength = Math.round(15 + (clicks / max.value) * 85)
  return { backgroundColor: `color-mix(in oklab, var(--chart-1) ${strength}%, transparent)` }
}

function cellTitle(point: HeatmapPoint) {
  return t('clicks.heatmap.tooltip', {
    day: t(`clicks.weekdays.${point.weekday}`),
    hour: String(point.hour).padStart(2, '0'),
    clicks: point.clicks,
    visitors: point.visitors,
  })
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t('clicks.heatmap.title') }}</CardTitle>
      <CardDescription>{{ $t('clicks.heatmap.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="overflow-x-auto">
      <div
        class="
          grid min-w-2xl grid-cols-[3rem_repeat(24,minmax(0,1fr))] gap-0.5
          text-xs
        "
      >
        <div />
        <div
          v-for="hour in hours" :key="hour" class="
            text-center text-muted-foreground tabular-nums
          "
        >
          {{ hour % 3 === 0 ? hour : '' }}
        </div>
        <template v-for="(row, rowIndex) in grid" :key="weekdays[rowIndex]">
          <div class="flex items-center text-muted-foreground">
            {{ $t(`clicks.weekdays.${weekdays[rowIndex]}`) }}
          </div>
          <div
            v-for="point in row"
            :key="point.hour"
            class="aspect-square rounded-sm bg-muted"
            :style="cellStyle(point.clicks)"
            :title="cellTitle(point)"
            :aria-label="cellTitle(point)"
            role="img"
          />
        </template>
      </div>
    </CardContent>
  </Card>
</template>
