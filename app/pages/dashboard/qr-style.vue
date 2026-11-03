<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

// Fork: admin page for the default QR code style.
const { state, load } = useQrStyle()
const { origin } = useShortLinkBase()
const formKey = shallowRef(0)
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

onMounted(() => load(true))
</script>

<template>
  <main class="space-y-6">
    <h1 class="sr-only">
      {{ $t('nav.qr_style') }}
    </h1>
    <Card>
      <CardHeader>
        <CardTitle>{{ $t('branding.qr_style.title') }}</CardTitle>
        <CardDescription>{{ $t('branding.qr_style.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <template v-if="state">
          <Alert v-if="!state.configured">
            <AlertTitle>{{ $t('branding.qr_style.not_configured') }}</AlertTitle>
          </Alert>
          <p v-else-if="state.updatedAt" class="text-sm text-muted-foreground">
            {{ $t('branding.qr_style.updated', { time: timeFormat.format(state.updatedAt), who: state.updatedBy || '-' }) }}
          </p>
          <DashboardBrandingQrStyleForm :key="formKey" :initial="state.style" :preview-data="`${origin}/example`" @saved="formKey++" />
        </template>
      </CardContent>
    </Card>
  </main>
</template>
