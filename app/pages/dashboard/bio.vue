<script setup lang="ts">
import type { BioPage } from '#shared/schemas/settings'

definePageMeta({
  layout: 'dashboard',
})

// Fork: admin page for the links page ("link in bio").
interface BioState { page: BioPage, configured: boolean, updatedAt: number | null, updatedBy: string | null, home: boolean }

const state = ref<BioState | null>(null)
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  state.value = await useAPI<BioState>('/api/settings/bio')
}

onMounted(load)
</script>

<template>
  <main class="space-y-6">
    <h1 class="sr-only">
      {{ $t('nav.bio') }}
    </h1>
    <Card>
      <CardHeader>
        <CardTitle>{{ $t('branding.bio.title') }}</CardTitle>
        <CardDescription>{{ $t('branding.bio.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <template v-if="state">
          <Alert>
            <AlertTitle>{{ state.home ? $t('branding.bio.home_on') : $t('branding.bio.home_off') }}</AlertTitle>
          </Alert>
          <p v-if="state.updatedAt" class="text-sm text-muted-foreground">
            {{ $t('branding.qr_style.updated', { time: timeFormat.format(state.updatedAt), who: state.updatedBy || '-' }) }}
          </p>
          <DashboardBrandingBioPageForm :key="state.updatedAt ?? 0" :initial="state.page" @saved="load" />
        </template>
      </CardContent>
    </Card>
  </main>
</template>
