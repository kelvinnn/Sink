<script setup lang="ts">
import type { Role } from '#shared/schemas/admin'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import { ROLES, UpdateUserSchema } from '#shared/schemas/admin'

// Fork: pre-assign a role to an email before its first sign-in.
const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const defaultValues: { email: string, role: Role } = { email: '', role: 'editor' }

const form = useForm({
  defaultValues,
  onSubmit: async ({ value, formApi }) => {
    try {
      await useAPI('/api/users/update', { method: 'POST', body: UpdateUserSchema.parse(value) })
      toast.success(t('admin.users.updated'))
      formApi.reset()
      emit('saved')
    }
    catch (error) {
      toast.error(t('admin.users.update_failed'), { description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage })
    }
  },
})

const validateEmail = makeZodValidator(UpdateUserSchema.shape.email)

function toRole(value: unknown): Role {
  return (ROLES as readonly string[]).includes(String(value)) ? value as Role : 'editor'
}
</script>

<template>
  <form class="flex flex-wrap items-end gap-2" @submit.prevent="form.handleSubmit">
    <form.Field v-slot="{ field }" name="email" :validators="{ onSubmit: validateEmail }">
      <Field
        class="
          w-full
          sm:w-72
        " :data-invalid="isInvalid(field)"
      >
        <FieldLabel :for="field.name">
          {{ $t('admin.users.email') }}
        </FieldLabel>
        <Input
          :id="field.name"
          type="email"
          autocomplete="off"
          :model-value="field.state.value"
          :aria-invalid="getAriaInvalid(field)"
          @update:model-value="field.handleChange(String($event))"
        />
      </Field>
    </form.Field>
    <form.Field v-slot="{ field }" name="role">
      <Field class="w-36">
        <FieldLabel :for="field.name">
          {{ $t('admin.users.role') }}
        </FieldLabel>
        <NativeSelect :id="field.name" :model-value="field.state.value" @update:model-value="field.handleChange(toRole($event))">
          <NativeSelectOption v-for="role in ROLES" :key="role" :value="role">
            {{ $t(`admin.roles.${role}`) }}
          </NativeSelectOption>
        </NativeSelect>
      </Field>
    </form.Field>
    <Button type="submit">
      {{ $t('admin.users.add') }}
    </Button>
  </form>
</template>
