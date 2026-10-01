<script setup lang="ts">
import { RefreshCw, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'

definePageMeta({
  layout: 'dashboard',
})

interface KnownIp {
  id: number
  cidr: string
  label: string
  category: string
  exclude: boolean
  note: string | null
}

const { t } = useI18n()
const items = ref<KnownIp[]>([])
const loading = shallowRef(true)
const applying = shallowRef(false)
const pendingDelete = ref<KnownIp | null>(null)
const deleteOpen = shallowRef(false)

async function load() {
  loading.value = true
  try {
    items.value = (await useAPI<{ knownIps: KnownIp[] }>('/api/known-ips/list')).knownIps
  }
  finally {
    loading.value = false
  }
}

async function apply() {
  applying.value = true
  try {
    const result = await useAPI<{ excludedClicks: number }>('/api/known-ips/apply', { method: 'POST' })
    toast.success(t('known_ips.applied', { excluded: result.excludedClicks }))
  }
  catch {
    toast.error(t('known_ips.apply_failed'))
  }
  finally {
    applying.value = false
  }
}

function askDelete(item: KnownIp) {
  pendingDelete.value = item
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value)
    return
  await useAPI('/api/known-ips/delete', { method: 'POST', body: { id: pendingDelete.value.id } })
  toast.success(t('known_ips.deleted'))
  await load()
}

onMounted(load)
</script>

<template>
  <main class="space-y-6">
    <h1 class="sr-only">
      {{ $t('nav.known_ips') }}
    </h1>
    <Teleport to="#dashboard-header-actions" defer>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="applying" @click="apply">
          <RefreshCw aria-hidden="true" class="size-4" />
          {{ $t('known_ips.apply') }}
        </Button>
        <DashboardKnownIpsCreateModal @created="load" />
      </div>
    </Teleport>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('known_ips.title') }}</CardTitle>
        <CardDescription>{{ $t('known_ips.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="overflow-x-auto">
        <Table class="min-w-3xl table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead class="w-48">
                {{ $t('known_ips.table.cidr') }}
              </TableHead>
              <TableHead class="w-48">
                {{ $t('known_ips.table.label') }}
              </TableHead>
              <TableHead class="w-28">
                {{ $t('known_ips.table.category') }}
              </TableHead>
              <TableHead class="w-24">
                {{ $t('known_ips.table.exclude') }}
              </TableHead>
              <TableHead>{{ $t('known_ips.table.note') }}</TableHead>
              <TableHead class="w-20 text-right">
                {{ $t('known_ips.table.actions') }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty v-if="!loading && items.length === 0" :colspan="6">
              {{ $t('known_ips.empty') }}
            </TableEmpty>
            <TableRow v-for="item in items" :key="item.id">
              <TableCell class="font-mono">
                {{ item.cidr }}
              </TableCell>
              <TableCell class="truncate font-medium">
                {{ item.label }}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {{ $t(`known_ips.categories.${item.category}`) }}
                </Badge>
              </TableCell>
              <TableCell>
                {{ item.exclude ? $t('known_ips.table.yes') : $t('known_ips.table.no') }}
              </TableCell>
              <TableCell class="truncate text-muted-foreground" :title="item.note || ''">
                {{ item.note || '-' }}
              </TableCell>
              <TableCell class="text-right">
                <Button variant="ghost" size="icon-sm" :aria-label="$t('common.delete')" @click="askDelete(item)">
                  <Trash2 aria-hidden="true" class="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <DashboardKnownIpsDeleteDialog v-model:open="deleteOpen" :cidr="pendingDelete?.cidr ?? ''" @confirm="confirmDelete" />
  </main>
</template>
