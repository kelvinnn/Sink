<script setup lang="ts">
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'

// Fork: lock a link, until unlocked or until a date.
const props = defineProps<{
  slug: string
  formId: string
}>()

const emit = defineEmits<{
  locked: []
}>()

const { t } = useI18n()
const presets = ['forever', '1m', '3m', '6m', '1y', 'custom'] as const
type Preset = typeof presets[number]
const MONTHS: Record<string, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }

interface LockFormValues {
  preset: Preset
  until: string
  reason: string
}

const defaultValues: LockFormValues = { preset: 'forever', until: '', reason: '' }
const today = new Date().toISOString().slice(0, 10)

function expiryFor(value: LockFormValues): number | undefined {
  if (value.preset === 'forever')
    return undefined
  if (value.preset === 'custom') {
    if (!value.until)
      return undefined
    // End of the chosen day, local time.
    return Math.floor(new Date(`${value.until}T23:59:59`).getTime() / 1000)
  }
  const date = new Date()
  date.setMonth(date.getMonth() + MONTHS[value.preset]!)
  return Math.floor(date.getTime() / 1000)
}

const form = useForm({
  defaultValues,
  onSubmit: async ({ value }) => {
    try {
      await useAPI('/api/link/lock', { method: 'POST', body: { slug: props.slug, expiresAt: expiryFor(value), reason: value.reason.trim() || undefined } })
      toast.success(t('admin.lock.locked'))
      emit('locked')
    }
    catch (error) {
      toast.error(t('admin.lock.failed'), { description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage })
    }
  },
})

function toPreset(value: unknown): Preset {
  return (presets as readonly string[]).includes(String(value)) ? value as Preset : 'forever'
}
</script>

<template>
  <form :id="props.formId" class="space-y-4" @submit.prevent="form.handleSubmit">
    <FieldGroup>
      <form.Field v-slot="{ field }" name="preset">
        <Field>
          <FieldLabel :for="field.name">
            {{ $t('admin.lock.duration') }}
          </FieldLabel>
          <NativeSelect :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(toPreset($event))">
            <NativeSelectOption v-for="preset in presets" :key="preset" :value="preset">
              {{ $t(`admin.lock.${preset}`) }}
            </NativeSelectOption>
          </NativeSelect>
        </Field>
      </form.Field>

      <form.Subscribe v-slot="{ values }">
        <form.Field v-if="values.preset === 'custom'" v-slot="{ field }" name="until">
          <Field>
            <FieldLabel :for="field.name">
              {{ $t('admin.lock.until') }}
            </FieldLabel>
            <Input
              :id="field.name"
              type="date"
              required
              :min="today"
              :model-value="field.state.value"
              @update:model-value="field.handleChange(String($event))"
            />
          </Field>
        </form.Field>
      </form.Subscribe>

      <form.Field v-slot="{ field }" name="reason">
        <Field>
          <FieldLabel :for="field.name">
            {{ $t('admin.lock.reason') }}
          </FieldLabel>
          <Input
            :id="field.name"
            autocomplete="off"
            maxlength="256"
            :placeholder="$t('admin.lock.reason_placeholder')"
            :model-value="field.state.value"
            @update:model-value="field.handleChange(String($event))"
          />
        </Field>
      </form.Field>
    </FieldGroup>
  </form>
</template>
