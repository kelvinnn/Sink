<script setup lang="ts">
import { History, RotateCcw } from '@lucide/vue'
import { toast } from 'vue-sonner'

// Fork: change history of one link, with "return to this version".
const props = defineProps<{
  linkId: string
  slug: string
}>()

interface HistoryEntry {
  id: number
  ts: number
  actorEmail: string
  actorRole: string
  action: string
  note: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

const { t } = useI18n()
const { canEdit } = useDashboardSession()
const linksStore = useDashboardLinksStore()
const { refresh } = useLinkMeta()
const entries = ref<HistoryEntry[]>([])
const loading = shallowRef(true)
const failed = shallowRef(false)
const reverting = shallowRef<number | null>(null)
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  loading.value = true
  failed.value = false
  try {
    entries.value = (await useAPI<{ history: HistoryEntry[] }>('/api/activity/link', { query: { id: props.linkId } })).history
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

watch(() => props.linkId, load, { immediate: true })
linksStore.onLinkUpdate(({ link }) => {
  if (link.id === props.linkId)
    void load()
})

async function revert(entry: HistoryEntry) {
  reverting.value = entry.id
  try {
    const result = await useAPI<{ link: Parameters<typeof linksStore.notifyLinkUpdate>[0] }>('/api/link/revert', { method: 'POST', body: { activityId: entry.id } })
    toast.success(t('admin.history.reverted'))
    linksStore.notifyLinkUpdate(result.link, 'edit')
    refresh(props.linkId)
    await load()
  }
  catch (error) {
    toast.error(t('admin.history.revert_failed'), { description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage })
  }
  finally {
    reverting.value = null
  }
}

// The newest entry that carries a version is the current one.
const currentId = computed(() => entries.value.find(entry => entry.after)?.id)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <History aria-hidden="true" class="size-4" />
        {{ $t('admin.history.title') }}
      </CardTitle>
      <CardDescription>{{ $t('admin.history.description') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <p v-if="failed" class="text-sm text-destructive">
        {{ $t('admin.history.load_failed') }}
      </p>
      <p
        v-else-if="!loading && entries.length === 0" class="
          text-sm text-muted-foreground
        "
      >
        {{ $t('admin.history.empty') }}
      </p>
      <ol v-else class="space-y-4">
        <li
          v-for="entry in entries" :key="entry.id" class="
            flex flex-col gap-1 border-l-2 pl-3 text-sm
          "
        >
          <div class="flex flex-wrap items-center gap-2">
            <Badge :variant="entry.action === 'link.delete' ? 'destructive' : 'secondary'">
              {{ $t(`admin.actions.${entry.action.replace('.', '_')}`) }}
            </Badge>
            <span class="font-medium" :title="entry.actorEmail">{{ actorName(entry.actorEmail) }}</span>
            <span class="text-muted-foreground">{{ timeFormat.format(entry.ts) }}</span>
            <Badge v-if="entry.id === currentId" variant="outline">
              {{ $t('admin.history.current') }}
            </Badge>
            <Button
              v-else-if="canEdit && entry.after"
              variant="outline"
              size="xs"
              :disabled="reverting !== null"
              @click="revert(entry)"
            >
              <RotateCcw aria-hidden="true" class="size-3" />
              {{ $t('admin.history.revert') }}
            </Button>
          </div>
          <p v-if="entry.note" class="text-muted-foreground">
            {{ entry.note }}
          </p>
          <ul v-if="entry.before && entry.after" class="space-y-0.5 text-xs">
            <li
              v-for="change in snapshotDiff(entry.before, entry.after)" :key="change.key" class="
                break-all
              "
            >
              <span class="font-medium">{{ change.key }}:</span>
              <span class="text-muted-foreground line-through">{{ change.from }}</span>
              → {{ change.to }}
            </li>
          </ul>
          <p
            v-else-if="(entry.after ?? entry.before)?.url" class="
              text-xs break-all text-muted-foreground
            "
          >
            {{ (entry.after ?? entry.before)?.url }}
          </p>
        </li>
      </ol>
    </CardContent>
  </Card>
</template>
