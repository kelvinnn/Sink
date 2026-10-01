<script setup lang="ts">
import { Bot, Globe, MousePointerClick, Network, Repeat, ShieldCheck, UserPlus, Users } from '@lucide/vue'
import NumberFlow from '@number-flow/vue'

interface ClickSummary {
  clicks: number
  visitors: number
  newVisitors: number
  returningClicks: number
  ips: number
  networks: number
  bots: number
  known: number
}

const store = useDashboardClicksStore()
const summary = ref<ClickSummary | null>(null)
const error = shallowRef(false)

watch(() => store.query, async (query, _old, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  error.value = false
  try {
    const result = await useAPI<ClickSummary>('/api/clicks/summary', { query, signal: controller.signal })
    if (!controller.signal.aborted)
      summary.value = result
  }
  catch {
    if (!controller.signal.aborted)
      error.value = true
  }
}, { immediate: true })

const cards = computed(() => [
  { key: 'clicks', icon: MousePointerClick, value: summary.value?.clicks },
  { key: 'visitors', icon: Users, value: summary.value?.visitors },
  { key: 'new_visitors', icon: UserPlus, value: summary.value?.newVisitors },
  { key: 'returning_clicks', icon: Repeat, value: summary.value?.returningClicks },
  { key: 'ips', icon: Globe, value: summary.value?.ips },
  { key: 'networks', icon: Network, value: summary.value?.networks },
  { key: 'bots', icon: Bot, value: summary.value?.bots },
  { key: 'known', icon: ShieldCheck, value: summary.value?.known },
])
</script>

<template>
  <Alert v-if="error" variant="destructive">
    <AlertTitle>{{ $t('clicks.table.error') }}</AlertTitle>
  </Alert>
  <div
    v-else
    class="
      grid grid-cols-2 gap-3
      sm:grid-cols-4
      xl:grid-cols-8
    "
  >
    <Card v-for="card in cards" :key="card.key" class="gap-2 py-4">
      <CardHeader class="flex flex-row items-center justify-between gap-2 px-4">
        <CardDescription class="truncate">
          {{ $t(`clicks.summary.${card.key}`) }}
        </CardDescription>
        <component
          :is="card.icon" aria-hidden="true" class="
            size-4 shrink-0 text-muted-foreground
          "
        />
      </CardHeader>
      <CardContent class="px-4">
        <Skeleton v-if="card.value === undefined" class="h-7 w-16" />
        <NumberFlow
          v-else :value="card.value" class="text-2xl font-semibold tabular-nums"
        />
      </CardContent>
    </Card>
  </div>
</template>
