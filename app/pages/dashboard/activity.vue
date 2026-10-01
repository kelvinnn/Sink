<script setup lang="ts">
import { toast } from 'vue-sonner'

// Fork: activity log (admin only).
definePageMeta({
  layout: 'dashboard',
})

interface ActivityEntry {
  id: number
  ts: number
  actorEmail: string
  actorRole: string
  authMethod: string
  ip: string | null
  action: string
  targetType: string
  targetId: string | null
  targetLabel: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  note: string | null
}

const { t } = useI18n()
const entries = ref<ActivityEntry[]>([])
const cursor = shallowRef<number | null>(null)
const loading = shallowRef(false)
const failed = shallowRef(false)
const search = shallowRef('')
const scope = shallowRef('all')
const baselining = shallowRef(false)
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

const scopes: Record<string, { action?: string, targetType?: string }> = {
  all: {},
  links_only: { targetType: 'link' },
  exports_only: { action: '*export' },
  users_only: { targetType: 'user' },
  known_ips_only: { targetType: 'known_ip' },
}

async function load(reset: boolean) {
  loading.value = true
  failed.value = false
  try {
    const filter = scopes[scope.value] ?? {}
    const isExports = scope.value === 'exports_only'
    const result = await useAPI<{ activity: ActivityEntry[], cursor: number | null }>('/api/activity/list', {
      query: {
        limit: 50,
        before: reset ? undefined : cursor.value ?? undefined,
        q: search.value.trim() || undefined,
        targetType: isExports ? undefined : filter.targetType,
        action: isExports ? undefined : filter.action,
      },
    })
    const rows = isExports ? result.activity.filter(row => row.action.endsWith('.export') || row.action === 'links.backup') : result.activity
    entries.value = reset ? rows : [...entries.value, ...rows]
    cursor.value = result.cursor
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 400, true)
})
watch(scope, () => load(true))
onMounted(() => load(true))

async function baseline() {
  baselining.value = true
  try {
    const result = await useAPI<{ recorded: number }>('/api/activity/baseline', { method: 'POST' })
    toast.success(t('admin.activity.baseline_done', { count: result.recorded }))
    await load(true)
  }
  catch {
    toast.error(t('admin.activity.failed'))
  }
  finally {
    baselining.value = false
  }
}

function details(entry: ActivityEntry): string {
  if (entry.before && entry.after) {
    const changes = snapshotDiff(entry.before, entry.after)
    return changes.length ? changes.map(change => `${change.key}: ${change.from} → ${change.to}`).join('\n') : t('admin.history.no_changes')
  }
  const snapshot = entry.after ?? entry.before
  return [snapshot?.url ?? (snapshot ? JSON.stringify(snapshot) : ''), entry.note].filter(Boolean).join('\n')
}
</script>

<template>
  <main class="space-y-6">
    <h1 class="sr-only">
      {{ $t('nav.activity') }}
    </h1>
    <Teleport to="#dashboard-header-actions" defer>
      <Button variant="outline" size="sm" :disabled="baselining" :title="$t('admin.activity.baseline_hint')" @click="baseline">
        {{ $t('admin.activity.baseline') }}
      </Button>
    </Teleport>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('admin.activity.title') }}</CardTitle>
        <CardDescription>{{ $t('admin.activity.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <Input
            v-model="search" class="
              w-full
              sm:w-72
            " :placeholder="$t('admin.activity.search')" :aria-label="$t('admin.activity.search')"
          />
          <NativeSelect v-model="scope" size="sm" :aria-label="$t('admin.activity.action')">
            <NativeSelectOption value="all">
              {{ $t('admin.activity.all_actions') }}
            </NativeSelectOption>
            <NativeSelectOption v-for="key in ['links_only', 'exports_only', 'users_only', 'known_ips_only']" :key="key" :value="key">
              {{ $t(`admin.activity.${key}`) }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <p v-if="failed" class="text-sm text-destructive">
          {{ $t('admin.activity.failed') }}
        </p>
        <div class="overflow-x-auto">
          <Table class="min-w-5xl table-fixed text-xs">
            <TableHeader>
              <TableRow>
                <TableHead class="w-44">
                  {{ $t('admin.activity.time') }}
                </TableHead>
                <TableHead class="w-44">
                  {{ $t('admin.activity.who') }}
                </TableHead>
                <TableHead class="w-40">
                  {{ $t('admin.activity.action') }}
                </TableHead>
                <TableHead class="w-44">
                  {{ $t('admin.activity.target') }}
                </TableHead>
                <TableHead>{{ $t('admin.activity.details') }}</TableHead>
                <TableHead class="w-36">
                  {{ $t('admin.activity.ip') }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!loading && entries.length === 0" :colspan="6">
                {{ $t('admin.activity.empty') }}
              </TableEmpty>
              <TableRow
                v-for="entry in entries" :key="entry.id" class="align-top"
              >
                <TableCell class="whitespace-nowrap tabular-nums">
                  {{ timeFormat.format(entry.ts) }}
                </TableCell>
                <TableCell>
                  <div class="truncate" :title="entry.actorEmail">
                    {{ entry.actorEmail }}
                  </div>
                  <span class="text-muted-foreground">{{ $t(`admin.roles.${entry.actorRole}`) }} · {{ entry.authMethod }}</span>
                </TableCell>
                <TableCell>
                  <Badge :variant="entry.action.endsWith('delete') ? 'destructive' : 'secondary'">
                    {{ $te(`admin.actions.${entry.action.replace('.', '_')}`) ? $t(`admin.actions.${entry.action.replace('.', '_')}`) : entry.action }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <NuxtLink
                    v-if="entry.targetType === 'link' && entry.targetLabel"
                    class="
                      block truncate
                      hover:underline
                    "
                    :to="getDashboardLinkDetailUrl(entry.targetLabel)"
                    :title="entry.targetLabel"
                  >
                    {{ entry.targetLabel }}
                  </NuxtLink>
                  <span v-else class="block truncate" :title="entry.targetLabel || ''">{{ entry.targetLabel || '-' }}</span>
                </TableCell>
                <TableCell>
                  <div
                    class="
                      max-h-24 overflow-y-auto break-all whitespace-pre-line
                      text-muted-foreground
                    "
                  >
                    {{ details(entry) }}
                  </div>
                </TableCell>
                <TableCell class="truncate font-mono" :title="entry.ip || ''">
                  {{ entry.ip || '-' }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div v-if="cursor" class="flex justify-center">
          <Button variant="outline" size="sm" :disabled="loading" @click="load(false)">
            {{ $t('admin.activity.load_more') }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </main>
</template>
