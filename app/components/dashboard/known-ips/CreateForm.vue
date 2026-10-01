<script setup lang="ts">
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import { CreateKnownIpSchema, KNOWN_IP_CATEGORIES } from '#shared/schemas/click'

const props = defineProps<{
  formId: string
}>()

const emit = defineEmits<{
  created: []
}>()

const { t } = useI18n()

interface KnownIpFormValues {
  cidr: string
  label: string
  category: typeof KNOWN_IP_CATEGORIES[number]
  exclude: boolean
  note: string
}

const defaultValues: KnownIpFormValues = { cidr: '', label: '', category: 'outlet', exclude: true, note: '' }

const form = useForm({
  defaultValues,
  onSubmit: async ({ value }) => {
    try {
      await useAPI('/api/known-ips/create', { method: 'POST', body: CreateKnownIpSchema.parse({ ...value, note: value.note || undefined }) })
      toast.success(t('known_ips.created'))
      emit('created')
    }
    catch (error) {
      const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
      toast.error(t('known_ips.create_failed'), { description: message })
    }
  },
})

function toCategory(value: unknown): KnownIpFormValues['category'] {
  return (KNOWN_IP_CATEGORIES as readonly string[]).includes(String(value)) ? value as KnownIpFormValues['category'] : 'other'
}

const validateCidr = makeZodValidator(CreateKnownIpSchema.shape.cidr)
const validateLabel = makeZodValidator(CreateKnownIpSchema.shape.label)
</script>

<template>
  <form :id="props.formId" class="space-y-4" @submit.prevent="form.handleSubmit">
    <FieldGroup>
      <form.Field v-slot="{ field }" name="cidr" :validators="{ onBlur: validateCidr, onSubmit: validateCidr }">
        <Field :data-invalid="isInvalid(field)">
          <FieldLabel :for="field.name">
            {{ $t('known_ips.form.cidr') }}
          </FieldLabel>
          <Input
            :id="field.name"
            :name="field.name"
            autocomplete="off"
            spellcheck="false"
            class="font-mono"
            :model-value="field.state.value"
            :aria-invalid="getAriaInvalid(field)"
            @blur="field.handleBlur"
            @update:model-value="field.handleChange(String($event))"
          />
          <FieldDescription>{{ $t('known_ips.form.cidr_hint') }}</FieldDescription>
          <FieldError v-if="isInvalid(field)" :errors="field.state.meta.errors" />
        </Field>
      </form.Field>

      <form.Field v-slot="{ field }" name="label" :validators="{ onBlur: validateLabel, onSubmit: validateLabel }">
        <Field :data-invalid="isInvalid(field)">
          <FieldLabel :for="field.name">
            {{ $t('known_ips.form.label') }}
          </FieldLabel>
          <Input
            :id="field.name"
            :name="field.name"
            autocomplete="off"
            :model-value="field.state.value"
            :aria-invalid="getAriaInvalid(field)"
            @blur="field.handleBlur"
            @update:model-value="field.handleChange(String($event))"
          />
          <FieldError v-if="isInvalid(field)" :errors="field.state.meta.errors" />
        </Field>
      </form.Field>

      <form.Field v-slot="{ field }" name="category">
        <Field>
          <FieldLabel :for="field.name">
            {{ $t('known_ips.form.category') }}
          </FieldLabel>
          <NativeSelect
            :id="field.name"
            :model-value="field.state.value"
            @update:model-value="field.handleChange(toCategory($event))"
          >
            <NativeSelectOption v-for="category in KNOWN_IP_CATEGORIES" :key="category" :value="category">
              {{ $t(`known_ips.categories.${category}`) }}
            </NativeSelectOption>
          </NativeSelect>
        </Field>
      </form.Field>

      <form.Field v-slot="{ field }" name="exclude">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel :for="field.name">
              {{ $t('known_ips.form.exclude') }}
            </FieldLabel>
            <FieldDescription>{{ $t('known_ips.form.exclude_hint') }}</FieldDescription>
          </FieldContent>
          <Switch :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(Boolean($event))" />
        </Field>
      </form.Field>

      <form.Field v-slot="{ field }" name="note">
        <Field>
          <FieldLabel :for="field.name">
            {{ $t('known_ips.form.note') }}
          </FieldLabel>
          <Input
            :id="field.name"
            :name="field.name"
            autocomplete="off"
            :model-value="field.state.value"
            @update:model-value="field.handleChange(String($event))"
          />
        </Field>
      </form.Field>
    </FieldGroup>
  </form>
</template>
