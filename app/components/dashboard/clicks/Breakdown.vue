<script setup lang="ts">
import type { ClickDimension } from '#shared/schemas/click'

const groups: ClickDimension[][] = [
  ['slug', 'tags', 'source', 'refererHost', 'inApp', 'served'],
  ['asOrg', 'networkType', 'ip', 'visitorId', 'knownIpLabel', 'botReason'],
  ['deviceType', 'os', 'browser', 'language', 'country', 'city', 'postalCode', 'day', 'hour', 'weekday'],
]
</script>

<template>
  <div
    class="
      grid gap-4
      lg:grid-cols-2
      2xl:grid-cols-3
    "
  >
    <Card v-for="(dimensions, index) in groups" :key="index" class="gap-2">
      <CardHeader v-if="index === 0">
        <CardTitle>{{ $t('clicks.breakdown.title') }}</CardTitle>
        <CardDescription>{{ $t('clicks.breakdown.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="px-2">
        <Tabs
          :default-value="dimensions[0]" class="
            flex flex-col
            lg:h-[460px]
          "
        >
          <div class="max-w-full shrink-0 overflow-x-auto p-1">
            <TabsList class="min-w-max">
              <TabsTrigger v-for="dimension in dimensions" :key="dimension" :value="dimension">
                {{ $t(`clicks.dimensions.${dimension}`) }}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            v-for="dimension in dimensions" :key="dimension" :value="dimension" class="
              min-h-0 flex-1
            "
          >
            <DashboardClicksBreakdownList :dimension="dimension" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  </div>
</template>
