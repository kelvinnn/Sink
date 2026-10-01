<script setup lang="ts">
import { Lock, UserPen } from '@lucide/vue'

// Fork: lock badge and "created by / edited by" for a link card.
const props = defineProps<{
  linkId: string
}>()

const { t, locale } = useI18n()
const { actors, locks, request, refresh } = useLinkMeta()
const linksStore = useDashboardLinksStore()
linksStore.onLinkUpdate(({ link }) => {
  if (link.id === props.linkId)
    refresh(props.linkId)
})

watch(() => props.linkId, id => request(id), { immediate: true })

const info = computed(() => actors[props.linkId])
const lock = computed(() => locks[props.linkId])

function byLabel(entry: { by: string, action: string }) {
  const key = `admin.meta.by_action.${entry.action.replace('.', '_')}`
  return t(key, { name: actorName(entry.by) })
}

const lockLabel = computed(() => {
  if (!lock.value)
    return ''
  return lock.value.expiresAt
    ? t('admin.meta.locked_until', { date: shortDate(lock.value.expiresAt, locale.value) })
    : t('admin.meta.locked')
})

const lockTitle = computed(() => lock.value
  ? [t('admin.meta.locked_by', { name: actorName(lock.value.lockedBy) }), lock.value.reason].filter(Boolean).join(' · ')
  : '')
</script>

<template>
  <div
    v-if="lock || info"
    class="
      flex h-5 w-full min-w-0 items-center gap-2 overflow-hidden text-xs
      text-muted-foreground
    "
  >
    <Badge v-if="lock" variant="secondary" class="shrink-0 gap-1" :title="lockTitle">
      <Lock aria-hidden="true" class="size-3" />
      {{ lockLabel }}
    </Badge>
    <span
      v-if="info?.created" class="
        inline-flex min-w-0 items-center gap-1 truncate
      " :title="info.created.by"
    >
      <UserPen aria-hidden="true" class="size-3 shrink-0" />
      <span class="truncate">
        {{ byLabel(info.created) }}<template v-if="info.updated">
          · {{ byLabel(info.updated) }} {{ shortDate(Math.floor(info.updated.at / 1000), locale) }}
        </template>
      </span>
    </span>
  </div>
</template>
