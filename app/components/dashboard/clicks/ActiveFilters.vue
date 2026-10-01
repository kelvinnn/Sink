<script setup lang="ts">
import type { ClickDimension } from '#shared/schemas/click'
import { Search, X } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'

const store = useDashboardClicksStore()
const search = shallowRef(store.filters.q ?? '')

const applySearch = useDebounceFn((value: string) => {
  store.setFilter('q', value.trim() || undefined)
}, 400)

watch(search, value => applySearch(value))
// Keep the box in sync when filters change from the URL or "Clear all".
watch(() => store.filters.q, (value) => {
  if ((value ?? '') !== search.value.trim())
    search.value = value ?? ''
})

const chips = computed(() => Object.entries(store.filters)
  .filter(([key]) => key !== 'q')
  .map(([key, value]) => ({ key: key as ClickDimension, value: value! })))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <InputGroup
      class="
        w-full
        sm:w-80
      "
    >
      <InputGroupAddon>
        <Search aria-hidden="true" class="size-4" />
      </InputGroupAddon>
      <InputGroupInput v-model="search" :placeholder="$t('clicks.search')" :aria-label="$t('clicks.search')" />
    </InputGroup>
    <template v-if="chips.length">
      <span class="text-sm text-muted-foreground">{{ $t('clicks.filters.active') }}:</span>
      <Badge
        v-for="chip in chips" :key="chip.key" variant="secondary" class="gap-1"
      >
        <span class="text-muted-foreground">{{ $t(`clicks.dimensions.${chip.key}`) }}</span>
        <span class="max-w-60 truncate" :title="chip.value">{{ chip.value }}</span>
        <button
          type="button"
          class="
            rounded-sm opacity-70
            hover:opacity-100
          "
          :aria-label="$t('clicks.filters.remove', { name: $t(`clicks.dimensions.${chip.key}`) })"
          @click="store.setFilter(chip.key, undefined)"
        >
          <X aria-hidden="true" class="size-3" />
        </button>
      </Badge>
      <Button variant="link" size="sm" @click="store.clearFilters(); search = ''">
        {{ $t('clicks.filters.clear') }}
      </Button>
    </template>
  </div>
</template>
