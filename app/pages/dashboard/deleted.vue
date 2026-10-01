<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'
import { toast } from 'vue-sonner'

// Fork: deleted links that can be restored.
definePageMeta({
  layout: 'dashboard',
})

interface DeletedLink {
  activityId: number
  linkId: string
  slug: string
  deletedAt: number
  deletedBy: string
  link: { url?: string, comment?: string, tags?: string[] } | null
  slugTaken: boolean
}

const { t } = useI18n()
const { canEdit } = useDashboardSession()
const items = ref<DeletedLink[]>([])
const loading = shallowRef(true)
const restoring = shallowRef<number | null>(null)
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  loading.value = true
  try {
    items.value = (await useAPI<{ deleted: DeletedLink[] }>('/api/activity/deleted')).deleted
  }
  finally {
    loading.value = false
  }
}

async function restore(item: DeletedLink) {
  restoring.value = item.activityId
  try {
    await useAPI('/api/link/restore', { method: 'POST', body: { activityId: item.activityId } })
    toast.success(t('admin.deleted.restored'))
    await load()
  }
  catch (error) {
    toast.error(t('admin.deleted.restore_failed'), { description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage })
  }
  finally {
    restoring.value = null
  }
}

onMounted(load)
</script>

<template>
  <main class="space-y-6">
    <h1 class="sr-only">
      {{ $t('nav.deleted') }}
    </h1>
    <Card>
      <CardHeader>
        <CardTitle>{{ $t('admin.deleted.title') }}</CardTitle>
        <CardDescription>{{ $t('admin.deleted.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="overflow-x-auto">
        <Table class="min-w-3xl table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead class="w-48">
                {{ $t('admin.deleted.slug') }}
              </TableHead>
              <TableHead>{{ $t('admin.deleted.destination') }}</TableHead>
              <TableHead class="w-40">
                {{ $t('admin.deleted.deleted_by') }}
              </TableHead>
              <TableHead class="w-44">
                {{ $t('admin.deleted.deleted_at') }}
              </TableHead>
              <TableHead class="w-32 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty v-if="!loading && items.length === 0" :colspan="5">
              {{ $t('admin.deleted.empty') }}
            </TableEmpty>
            <TableRow v-for="item in items" :key="item.activityId">
              <TableCell class="truncate font-medium" :title="item.slug">
                {{ item.slug }}
              </TableCell>
              <TableCell class="truncate text-muted-foreground" :title="item.link?.url || ''">
                {{ item.link?.url || '-' }}
              </TableCell>
              <TableCell class="truncate" :title="item.deletedBy">
                {{ actorName(item.deletedBy) }}
              </TableCell>
              <TableCell class="whitespace-nowrap tabular-nums">
                {{ timeFormat.format(item.deletedAt) }}
              </TableCell>
              <TableCell class="text-right">
                <Badge v-if="item.slugTaken" variant="outline">
                  {{ $t('admin.deleted.slug_taken') }}
                </Badge>
                <Button v-else-if="canEdit" variant="outline" size="sm" :disabled="restoring !== null" @click="restore(item)">
                  <RotateCcw aria-hidden="true" class="size-4" />
                  {{ $t('admin.deleted.restore') }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </main>
</template>
