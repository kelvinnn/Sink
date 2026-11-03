<script setup lang="ts">
import type { BioPage } from '#shared/schemas/settings'
import { ArrowDown, ArrowUp, ImageUp, Plus, Trash2, X } from '@lucide/vue'
import { useForm, useStore } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import { BioPageSchema, LogoDataUrlSchema } from '#shared/schemas/settings'
import { renderBioPage } from '#shared/utils/bio-page'

// Fork: admin form for the links page ("link in bio"), with a live preview.

const props = defineProps<{
  initial: BioPage
}>()

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const { origin } = useShortLinkBase()

const form = useForm({
  defaultValues: structuredClone(toRaw(props.initial)) as BioPage,
  onSubmit: async ({ value }) => {
    try {
      await useAPI('/api/settings/bio', { method: 'POST', body: BioPageSchema.parse(value) })
      toast.success(t('branding.bio.saved'))
      emit('saved')
    }
    catch (error) {
      const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
      toast.error(t('branding.bio.save_failed'), { description: message })
    }
  },
})

const values = useStore(form.store, state => state.values)
// Preview links point at the public short-link host so they can be tried from the dashboard.
const previewHtml = computed(() => renderBioPage(values.value, { linkBase: origin.value }).replace('<head>', '<head><base target="_blank">'))
const colorFields = ['background', 'text', 'buttonBackground', 'buttonText'] as const
const textFields = ['title', 'description'] as const

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

type Button = BioPage['buttons'][number]

function moved(buttons: Button[], index: number, offset: number): Button[] {
  const next = [...buttons]
  const [item] = next.splice(index, 1)
  next.splice(index + offset, 0, item!)
  return next
}

function updated(buttons: Button[], index: number, patch: Partial<Button>): Button[] {
  return buttons.map((button, i) => i === index ? { ...button, ...patch } : button)
}
</script>

<template>
  <div
    class="
      grid gap-6
      xl:grid-cols-[1fr_380px]
    "
  >
    <form id="bio-page-form" class="space-y-4" @submit.prevent="form.handleSubmit">
      <FieldGroup>
        <form.Field v-slot="{ field }" name="enabled">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel :for="field.name">
                {{ $t('branding.bio.fields.enabled') }}
              </FieldLabel>
              <FieldDescription>{{ $t('branding.bio.fields.enabled_hint', { url: `${origin}/${values.path}` }) }}</FieldDescription>
            </FieldContent>
            <Switch :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(Boolean($event))" />
          </Field>
        </form.Field>

        <form.Field v-slot="{ field }" name="path">
          <Field>
            <FieldLabel :for="field.name">
              {{ $t('branding.bio.fields.path') }}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>{{ origin }}/</InputGroupAddon>
              <InputGroupInput :id="field.name" :model-value="field.state.value" autocomplete="off" @update:model-value="field.handleChange(String($event))" />
            </InputGroup>
            <FieldDescription>{{ $t('branding.bio.fields.path_hint') }}</FieldDescription>
          </Field>
        </form.Field>

        <form.Field v-for="name in textFields" :key="name" v-slot="{ field }" :name="name">
          <Field>
            <FieldLabel :for="field.name">
              {{ $t(`branding.bio.fields.${name}`) }}
            </FieldLabel>
            <Input :id="field.name" :model-value="field.state.value" autocomplete="off" @update:model-value="field.handleChange(String($event))" />
          </Field>
        </form.Field>

        <form.Field v-slot="{ field }" name="logo">
          <Field>
            <FieldLabel for="bio-logo-input">
              {{ $t('branding.bio.fields.logo') }}
            </FieldLabel>
            <div class="flex flex-wrap items-center gap-2">
              <img
                v-if="field.state.value" :src="field.state.value" alt="" class="
                  size-12 rounded-full border border-border object-contain
                "
              >
              <input
                id="bio-logo-input" ref="logoInput" type="file" accept="image/png,image/svg+xml" class="
                  sr-only
                " @change="readLogo(($event.target as HTMLInputElement).files?.[0])"
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

        <div
          class="
            grid gap-4
            sm:grid-cols-4
          "
        >
          <form.Field v-for="name in colorFields" :key="name" v-slot="{ field }" :name="name">
            <Field>
              <FieldLabel :for="field.name">
                {{ $t(`branding.bio.fields.${name}`) }}
              </FieldLabel>
              <input
                :id="field.name" type="color" class="
                  h-9 w-full cursor-pointer rounded-md border border-input
                  bg-transparent
                " :value="field.state.value" @input="field.handleChange(($event.target as HTMLInputElement).value)"
              >
            </Field>
          </form.Field>
        </div>

        <form.Field v-slot="{ field }" name="buttons">
          <Field>
            <FieldLabel>{{ $t('branding.bio.fields.buttons') }}</FieldLabel>
            <FieldDescription>{{ $t('branding.bio.fields.buttons_hint') }}</FieldDescription>
            <div class="space-y-2">
              <div
                v-for="(button, index) in field.state.value" :key="index" class="
                  flex items-center gap-2
                "
              >
                <Input
                  :model-value="button.label" :placeholder="$t('branding.bio.fields.label')" :aria-label="$t('branding.bio.fields.label')" class="
                    flex-1
                  "
                  @update:model-value="field.handleChange(updated(field.state.value, index, { label: String($event) }))"
                />
                <Input
                  :model-value="button.slug" :placeholder="$t('branding.bio.fields.slug')" :aria-label="$t('branding.bio.fields.slug')" class="
                    w-40 font-mono
                  "
                  @update:model-value="field.handleChange(updated(field.state.value, index, { slug: String($event) }))"
                />
                <Button type="button" variant="ghost" size="icon-sm" :disabled="index === 0" :aria-label="$t('branding.bio.move_up')" @click="field.handleChange(moved(field.state.value, index, -1))">
                  <ArrowUp aria-hidden="true" class="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" :disabled="index === field.state.value.length - 1" :aria-label="$t('branding.bio.move_down')" @click="field.handleChange(moved(field.state.value, index, 1))">
                  <ArrowDown aria-hidden="true" class="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" :aria-label="$t('common.delete')" @click="field.handleChange(field.state.value.filter((_, i) => i !== index))">
                  <Trash2 aria-hidden="true" class="size-4" />
                </Button>
              </div>
              <Button type="button" variant="outline" size="sm" @click="field.handleChange([...field.state.value, { label: '', slug: '' }])">
                <Plus aria-hidden="true" class="size-4" />
                {{ $t('branding.bio.add_button') }}
              </Button>
            </div>
          </Field>
        </form.Field>
      </FieldGroup>

      <Button type="submit">
        {{ $t('branding.bio.save') }}
      </Button>
    </form>

    <div class="space-y-2">
      <p class="text-sm font-medium">
        {{ $t('branding.qr_style.preview') }}
      </p>
      <iframe
        :srcdoc="previewHtml" :title="$t('branding.qr_style.preview')" sandbox="allow-popups allow-popups-to-escape-sandbox" class="
          h-[640px] w-full rounded-lg border border-border
        "
      />
    </div>
  </div>
</template>
