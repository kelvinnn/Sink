<script setup lang="ts">
import type { ClickDimension } from '#shared/schemas/click'
import type { ClickRow } from '@/composables/clicks'

const store = useDashboardClicksStore()
const { canSeeIps } = useDashboardSession()
const rows = ref<ClickRow[]>([])
const cursor = shallowRef<number | null>(null)
const loading = shallowRef(false)
const error = shallowRef(false)

async function load(reset: boolean, signal?: AbortSignal) {
  loading.value = true
  error.value = false
  try {
    const result = await useAPI<{ clicks: ClickRow[], cursor: number | null }>('/api/clicks/list', {
      query: { ...store.query, limit: 100, before: reset ? undefined : cursor.value ?? undefined },
      signal,
    })
    if (signal?.aborted)
      return
    rows.value = reset ? result.clicks : [...rows.value, ...result.clicks]
    cursor.value = result.cursor
  }
  catch {
    if (!signal?.aborted)
      error.value = true
  }
  finally {
    if (!signal?.aborted)
      loading.value = false
  }
}

watch(() => store.query, (_query, _old, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  load(true, controller.signal)
}, { immediate: true })

const timeFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function filterBy(key: ClickDimension, value: string | null) {
  if (value)
    store.setFilter(key, value)
}

function device(row: ClickRow) {
  return [row.deviceType, row.os, row.browser].filter(Boolean).join(' · ')
}

function location(row: ClickRow) {
  return [row.city, row.postalCode, row.country].filter(Boolean).join(', ')
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t('clicks.table.title') }}</CardTitle>
    </CardHeader>
    <CardContent>
      <Alert v-if="error" variant="destructive" class="mb-4">
        <AlertTitle>{{ $t('clicks.table.error') }}</AlertTitle>
      </Alert>
      <div class="overflow-x-auto">
        <Table class="min-w-7xl table-fixed text-xs">
          <TableHeader>
            <TableRow>
              <TableHead class="w-32">
                {{ $t('clicks.table.time') }}
              </TableHead>
              <TableHead class="w-36">
                {{ $t('clicks.table.link') }}
              </TableHead>
              <TableHead v-if="canSeeIps" class="w-44">
                {{ $t('clicks.table.ip') }}
              </TableHead>
              <TableHead class="w-48">
                {{ $t('clicks.table.network') }}
              </TableHead>
              <TableHead class="w-40">
                {{ $t('clicks.table.location') }}
              </TableHead>
              <TableHead class="w-44">
                {{ $t('clicks.table.device') }}
              </TableHead>
              <TableHead class="w-44">
                {{ $t('clicks.table.source') }}
              </TableHead>
              <TableHead class="w-28">
                {{ $t('clicks.table.visitor') }}
              </TableHead>
              <TableHead class="w-40">
                {{ $t('clicks.table.flags') }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty v-if="!loading && !error && rows.length === 0" :colspan="canSeeIps ? 9 : 8">
              {{ $t('clicks.table.empty') }}
            </TableEmpty>
            <TableRow v-for="row in rows" :key="row.id" :title="row.ua || ''">
              <TableCell class="whitespace-nowrap tabular-nums">
                {{ timeFormat.format(row.ts) }}
              </TableCell>
              <TableCell>
                <button
                  type="button" class="
                    truncate text-left
                    hover:underline
                  " :title="row.destination || ''" @click="filterBy('slug', row.slug)"
                >
                  {{ row.slug }}
                </button>
              </TableCell>
              <TableCell v-if="canSeeIps" class="font-mono">
                <button
                  type="button" class="
                    block w-full truncate text-left
                    hover:underline
                  " :title="row.ip || ''" @click="filterBy('ip', row.ip)"
                >
                  {{ row.ip }}
                </button>
              </TableCell>
              <TableCell>
                <button
                  type="button" class="
                    block w-full truncate text-left
                    hover:underline
                  " :title="`AS${row.asn ?? '?'} ${row.asOrg ?? ''}`" @click="filterBy('asOrg', row.asOrg)"
                >
                  {{ row.asOrg || '-' }}
                </button>
                <span class="text-muted-foreground">{{ row.networkType }}</span>
              </TableCell>
              <TableCell class="truncate" :title="location(row)">
                {{ location(row) || '-' }}
              </TableCell>
              <TableCell class="truncate" :title="[device(row), row.deviceVendor, row.deviceModel].filter(Boolean).join(' · ')">
                {{ device(row) || '-' }}
                <Badge v-if="row.inApp" variant="outline" class="ml-1">
                  {{ row.inApp }}
                </Badge>
              </TableCell>
              <TableCell class="truncate" :title="[row.source, row.referer, row.query].filter(Boolean).join(' · ')">
                {{ row.source || row.refererHost || '-' }}
              </TableCell>
              <TableCell>
                <button
                  v-if="row.visitorId" type="button" :class="canSeeIps ? `
                    hover:underline
                  ` : `cursor-default`" :title="canSeeIps ? row.visitorId : ''" @click="canSeeIps && filterBy('visitorId', row.visitorId)"
                >
                  {{ row.newVisitor ? $t('clicks.table.new') : $t('clicks.table.returning') }}
                </button>
                <span v-else class="text-muted-foreground">-</span>
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge v-if="row.isBot" variant="destructive" :title="row.botReason || ''">
                    {{ $t('clicks.table.bot') }}
                  </Badge>
                  <Badge v-if="row.knownIpLabel" variant="secondary">
                    {{ row.knownIpLabel }}
                  </Badge>
                  <Badge v-if="row.served" variant="outline">
                    {{ row.served }}
                  </Badge>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div v-if="cursor || loading" class="mt-4 flex justify-center">
        <Button variant="outline" size="sm" :disabled="loading" @click="load(false)">
          {{ loading ? $t('clicks.table.loading') : $t('clicks.table.load_more') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
