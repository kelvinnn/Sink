<script setup lang="ts">
import type { QrStyle } from '#shared/schemas/settings'
import { Download, Palette } from '@lucide/vue'
import QRCodeStyling from 'qr-code-styling'
import { DEFAULT_QR_STYLE } from '#shared/schemas/settings'
import { QR_PRINT_SIZE, qrData, qrStylingOptions } from '#shared/utils/qr-style'

const props = withDefaults(defineProps<{
  data: string
  image?: string
  // Fork: preview a style that is not saved yet (QR style settings page).
  qrStyle?: QrStyle
}>(), {
  image: '',
  qrStyle: undefined,
})

// Fork: codes use the admin's default style once one is saved; until then, upstream's look and colour picker.
const { state: savedStyle, load: loadStyle } = useQrStyle()
const { isAdmin } = useDashboardSession()
const color = ref('#000000')
const configured = computed(() => !!props.qrStyle || !!savedStyle.value?.configured)
const style = computed<QrStyle>(() => {
  if (props.qrStyle)
    return props.qrStyle
  if (savedStyle.value?.configured)
    return savedStyle.value.style
  return { ...DEFAULT_QR_STYLE, foreground: color.value, finder: color.value }
})
const encoded = computed(() => qrData(props.data, style.value.scanMarker))

const qrCode = new QRCodeStyling(qrStylingOptions(style.value, { data: encoded.value, image: props.image, size: 256 }))
const qrCodeEl = useTemplateRef<HTMLElement>('qrCodeEl')

watch([style, encoded, () => props.image], () => {
  qrCode.update(qrStylingOptions(style.value, { data: encoded.value, image: props.image, size: 256 }))
}, { deep: true })

function downloadQRCode(extension: 'png' | 'svg') {
  const slug = props.data.replace(/^https?:\/\/[^/]+\/?/, '').replace(/[^\w.-]+/g, '_') || 'home'
  const printable = new QRCodeStyling(qrStylingOptions(style.value, {
    data: encoded.value,
    image: props.image,
    size: QR_PRINT_SIZE,
    type: extension === 'svg' ? 'svg' : 'canvas',
  }))
  printable.download({ extension, name: `qr_${slug}` })
}

onMounted(() => {
  if (!props.qrStyle)
    void loadStyle()
  if (qrCodeEl.value) {
    qrCode.append(qrCodeEl.value as unknown as HTMLElement)
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div
      ref="qrCodeEl"
      :data-text="encoded"
      role="img"
      :aria-label="$t('links.qr.text_alternative', { url: encoded })"
      class="rounded-lg border border-border bg-white p-1 shadow-sm"
    />
    <div class="flex flex-wrap items-center justify-center gap-2">
      <div v-if="!configured" class="relative flex items-center">
        <label
          class="
            relative size-11 cursor-pointer overflow-hidden rounded-full border
            border-input ring-offset-background
            focus-within:ring-3 focus-within:ring-ring/50
            lg:size-9
          "
          :style="{ backgroundColor: color }"
          :title="$t('links.change_qr_color')"
        >
          <input
            v-model="color"
            type="color"
            class="absolute inset-0 size-full cursor-pointer opacity-0"
            :aria-label="$t('links.change_qr_color')"
            :title="$t('links.change_qr_color')"
          >
        </label>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="
          min-h-11
          lg:min-h-8
        "
        :aria-label="`${$t('links.download_qr_code')} (PNG)`"
        @click="downloadQRCode('png')"
      >
        <Download aria-hidden="true" class="mr-2 size-4" />
        {{ $t('branding.qr_style.download_png', { size: QR_PRINT_SIZE }) }}
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="
          min-h-11
          lg:min-h-8
        "
        :aria-label="`${$t('links.download_qr_code')} (SVG)`"
        @click="downloadQRCode('svg')"
      >
        <Download aria-hidden="true" class="mr-2 size-4" />
        {{ $t('branding.qr_style.download_svg') }}
      </Button>
    </div>
    <Button v-if="isAdmin && !qrStyle" variant="link" size="sm" as-child>
      <NuxtLink to="/dashboard/qr-style">
        <Palette aria-hidden="true" class="mr-1 size-4" />
        {{ $t('branding.qr_style.edit_default') }}
      </NuxtLink>
    </Button>
  </div>
</template>
