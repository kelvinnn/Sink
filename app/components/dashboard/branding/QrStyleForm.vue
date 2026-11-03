<script setup lang="ts">
import type { QrStyle } from '#shared/schemas/settings'
import { ImageUp, X } from '@lucide/vue'
import { useForm, useStore } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import {
  DEFAULT_QR_STYLE,
  LogoDataUrlSchema,
  QR_CORNER_STYLES,
  QR_DOT_STYLES,
  QR_ERROR_LEVELS,
  QR_SCAN_MARKERS,
  QrStyleSchema,
} from '#shared/schemas/settings'

// Fork: admin form for the default QR code style, with a live preview.

const props = defineProps<{
  initial: QrStyle
  previewData: string
}>()

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const { save } = useQrStyle()

const form = useForm({
  defaultValues: { ...props.initial } as QrStyle,
  onSubmit: async ({ value }) => {
    try {
      await save(QrStyleSchema.parse(value))
      toast.success(t('branding.qr_style.saved'))
      emit('saved')
    }
    catch (error) {
      const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
      toast.error(t('branding.qr_style.save_failed'), { description: message })
    }
  },
})

const values = useStore(form.store, state => state.values)
const colorFields = ['foreground', 'background', 'finder'] as const

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return (options as readonly string[]).includes(String(value)) ? value as T : fallback
}

const logoInput = useTemplateRef<HTMLInputElement>('logoInput')

function readLogo(file: File | undefined) {
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = () => {
    const result = LogoDataUrlSchema.safeParse(String(reader.result || ''))
    if (!result.success) {
      toast.error(t('branding.qr_style.fields.logo_invalid'))
      return
    }
    form.setFieldValue('logo', result.data)
  }
  reader.readAsDataURL(file)
  if (logoInput.value)
    logoInput.value.value = ''
}

function reset() {
  form.reset({ ...DEFAULT_QR_STYLE })
}
</script>

<template>
  <div
    class="
      grid gap-6
      lg:grid-cols-[1fr_auto]
    "
  >
    <form id="qr-style-form" class="space-y-4" @submit.prevent="form.handleSubmit">
      <FieldGroup>
        <div
          class="
            grid gap-4
            sm:grid-cols-3
          "
        >
          <form.Field v-for="name in colorFields" :key="name" v-slot="{ field }" :name="name">
            <Field>
              <FieldLabel :for="field.name">
                {{ $t(`branding.qr_style.fields.${name}`) }}
              </FieldLabel>
              <div class="flex items-center gap-2">
                <input
                  :id="`${field.name}-picker`"
                  type="color"
                  class="
                    h-9 w-12 cursor-pointer rounded-md border border-input
                    bg-transparent
                  "
                  :value="field.state.value"
                  :aria-label="$t(`branding.qr_style.fields.${name}`)"
                  @input="field.handleChange(($event.target as HTMLInputElement).value)"
                >
                <Input
                  :id="field.name"
                  :name="field.name"
                  class="font-mono"
                  maxlength="7"
                  :model-value="field.state.value"
                  @update:model-value="field.handleChange(String($event))"
                />
              </div>
            </Field>
          </form.Field>
        </div>

        <div
          class="
            grid gap-4
            sm:grid-cols-3
          "
        >
          <form.Field v-slot="{ field }" name="dotStyle">
            <Field>
              <FieldLabel :for="field.name">
                {{ $t('branding.qr_style.fields.dot_style') }}
              </FieldLabel>
              <NativeSelect :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(pick(QR_DOT_STYLES, $event, 'dots'))">
                <NativeSelectOption v-for="option in QR_DOT_STYLES" :key="option" :value="option">
                  {{ $t(`branding.qr_style.dot_styles.${option}`) }}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </form.Field>

          <form.Field v-slot="{ field }" name="cornerStyle">
            <Field>
              <FieldLabel :for="field.name">
                {{ $t('branding.qr_style.fields.corner_style') }}
              </FieldLabel>
              <NativeSelect :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(pick(QR_CORNER_STYLES, $event, 'rounded'))">
                <NativeSelectOption v-for="option in QR_CORNER_STYLES" :key="option" :value="option">
                  {{ $t(`branding.qr_style.corner_styles.${option}`) }}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </form.Field>

          <form.Field v-slot="{ field }" name="errorCorrection">
            <Field>
              <FieldLabel :for="field.name">
                {{ $t('branding.qr_style.fields.error_correction') }}
              </FieldLabel>
              <NativeSelect :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(pick(QR_ERROR_LEVELS, $event, 'auto'))">
                <NativeSelectOption v-for="option in QR_ERROR_LEVELS" :key="option" :value="option">
                  {{ $t(`branding.qr_style.error_levels.${option}`) }}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </form.Field>
        </div>
        <FieldDescription>{{ $t('branding.qr_style.fields.error_correction_hint') }}</FieldDescription>

        <form.Field v-slot="{ field }" name="logo">
          <Field>
            <FieldLabel for="qr-logo-input">
              {{ $t('branding.qr_style.fields.logo') }}
            </FieldLabel>
            <div class="flex flex-wrap items-center gap-2">
              <img
                v-if="field.state.value" :src="field.state.value" alt="" class="
                  size-12 rounded-md border border-border bg-white
                  object-contain p-1
                "
              >
              <input
                id="qr-logo-input"
                ref="logoInput"
                type="file"
                accept="image/png,image/svg+xml"
                class="sr-only"
                @change="readLogo(($event.target as HTMLInputElement).files?.[0])"
              >
              <Button type="button" variant="outline" size="sm" @click="logoInput?.click()">
                <ImageUp aria-hidden="true" class="size-4" />
                {{ $t('branding.qr_style.fields.logo_upload') }}
              </Button>
              <Button v-if="field.state.value" type="button" variant="ghost" size="sm" @click="field.handleChange(null)">
                <X aria-hidden="true" class="size-4" />
                {{ $t('branding.qr_style.fields.logo_remove') }}
              </Button>
            </div>
            <FieldDescription>{{ $t('branding.qr_style.fields.logo_hint') }}</FieldDescription>
          </Field>
        </form.Field>

        <form.Field v-slot="{ field }" name="linkIcon">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel :for="field.name">
                {{ $t('branding.qr_style.fields.link_icon') }}
              </FieldLabel>
            </FieldContent>
            <Switch :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(Boolean($event))" />
          </Field>
        </form.Field>

        <form.Field v-slot="{ field }" name="scanMarker">
          <Field>
            <FieldLabel :for="field.name">
              {{ $t('branding.qr_style.fields.scan_marker') }}
            </FieldLabel>
            <NativeSelect :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(pick(QR_SCAN_MARKERS, $event, 'none'))">
              <NativeSelectOption v-for="option in QR_SCAN_MARKERS" :key="option" :value="option">
                {{ $t(`branding.qr_style.scan_markers.${option}`) }}
              </NativeSelectOption>
            </NativeSelect>
            <FieldDescription>{{ $t('branding.qr_style.fields.scan_marker_hint') }}</FieldDescription>
          </Field>
        </form.Field>
      </FieldGroup>

      <div class="flex flex-wrap gap-2">
        <Button type="submit">
          {{ $t('branding.qr_style.save') }}
        </Button>
        <Button type="button" variant="outline" @click="reset">
          {{ $t('branding.qr_style.reset') }}
        </Button>
      </div>
    </form>

    <div class="flex flex-col items-center gap-2">
      <p class="text-sm font-medium">
        {{ $t('branding.qr_style.preview') }}
      </p>
      <DashboardLinksQRCode :data="props.previewData" :qr-style="values" />
      <p class="max-w-64 text-center text-xs text-muted-foreground">
        {{ $t('branding.qr_style.preview_hint') }}
      </p>
    </div>
  </div>
</template>
