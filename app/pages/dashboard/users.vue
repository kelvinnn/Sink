<script setup lang="ts">
import type { Role } from '#shared/schemas/admin'
import { toast } from 'vue-sonner'
import { ROLES } from '#shared/schemas/admin'

// Fork: users and roles (admin only).
definePageMeta({
  layout: 'dashboard',
})

interface DashboardUser {
  email: string
  role: Role
  disabled: boolean
  lastSeenAt: number | null
  fixedAdmin: boolean
}

const { t, locale } = useI18n()
const { session } = useDashboardSession()
const items = ref<DashboardUser[]>([])
const loading = shallowRef(true)

async function load() {
  loading.value = true
  try {
    items.value = (await useAPI<{ users: DashboardUser[] }>('/api/users/list')).users
  }
  finally {
    loading.value = false
  }
}

async function update(user: DashboardUser, change: { role?: Role, disabled?: boolean }) {
  try {
    await useAPI('/api/users/update', { method: 'POST', body: { email: user.email, ...change } })
    toast.success(t('admin.users.updated'))
  }
  catch (error) {
    toast.error(t('admin.users.update_failed'), { description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage })
  }
  await load()
}

function toRole(value: unknown): Role {
  return (ROLES as readonly string[]).includes(String(value)) ? value as Role : 'editor'
}

function locked(user: DashboardUser) {
  return user.fixedAdmin || user.email === session.value?.email
}

onMounted(load)
</script>

<template>
  <main class="space-y-6">
    <h1 class="sr-only">
      {{ $t('nav.users') }}
    </h1>
    <Card>
      <CardHeader>
        <CardTitle>{{ $t('admin.users.title') }}</CardTitle>
        <CardDescription>{{ $t('admin.users.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="overflow-x-auto">
          <Table class="min-w-2xl table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>{{ $t('admin.users.email') }}</TableHead>
                <TableHead class="w-40">
                  {{ $t('admin.users.role') }}
                </TableHead>
                <TableHead class="w-28">
                  {{ $t('admin.users.status') }}
                </TableHead>
                <TableHead class="w-36">
                  {{ $t('admin.users.last_seen') }}
                </TableHead>
                <TableHead class="w-28 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!loading && items.length === 0" :colspan="5">
                {{ $t('admin.users.empty') }}
              </TableEmpty>
              <TableRow v-for="user in items" :key="user.email">
                <TableCell class="truncate font-medium" :title="user.email">
                  {{ user.email }}
                </TableCell>
                <TableCell>
                  <Badge v-if="locked(user)" variant="secondary" :title="user.fixedAdmin ? $t('admin.users.fixed_admin') : ''">
                    {{ $t(`admin.roles.${user.role}`) }}
                  </Badge>
                  <NativeSelect
                    v-else
                    size="sm"
                    :model-value="user.role"
                    :aria-label="$t('admin.users.role')"
                    @update:model-value="update(user, { role: toRole($event) })"
                  >
                    <NativeSelectOption v-for="role in ROLES" :key="role" :value="role">
                      {{ $t(`admin.roles.${role}`) }}
                    </NativeSelectOption>
                  </NativeSelect>
                </TableCell>
                <TableCell>
                  <Badge :variant="user.disabled ? 'destructive' : 'outline'">
                    {{ user.disabled ? $t('admin.users.disabled') : $t('admin.users.active') }}
                  </Badge>
                </TableCell>
                <TableCell
                  class="whitespace-nowrap text-muted-foreground tabular-nums"
                >
                  {{ user.lastSeenAt ? shortDate(user.lastSeenAt, locale) : $t('admin.users.never') }}
                </TableCell>
                <TableCell class="text-right">
                  <Button v-if="!locked(user)" variant="outline" size="sm" @click="update(user, { disabled: !user.disabled })">
                    {{ user.disabled ? $t('admin.users.enable') : $t('admin.users.disable') }}
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">
            {{ $t('admin.users.add_hint') }}
          </p>
          <DashboardUsersAddForm @saved="load" />
        </div>
      </CardContent>
    </Card>
  </main>
</template>
