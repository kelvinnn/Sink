<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})
</script>

<template>
  <main class="space-y-6">
    <h1 class="sr-only">
      {{ $t('nav.clicks') }}
    </h1>
    <Teleport to="#dashboard-header-actions" defer>
      <DashboardClicksToolbar />
    </Teleport>

    <DashboardClicksActiveFilters />
    <DashboardClicksSummary />
    <DashboardClicksHeatmap />
    <DashboardClicksBreakdown />
    <DashboardClicksLogTable />
  </main>
</template>
