/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, Stack, useTheme, Text } from '@keystone-ui/core'
import { memo, type ReactNode, useContext, useId, useMemo } from 'react'
import { FieldDescription } from '@keystone-ui/fields'
import { ButtonContext } from '@keystone-ui/button'
import {
  type FieldGroupMeta,
  type FieldMeta,
  type ControllerValue
} from '../../types'

const RenderField = memo(function RenderField ({
  field,
  autoFocus,
  forceValidation,
  onChange,
  value,
  itemValue,
}: {
  field: FieldMeta
  autoFocus?: boolean
  forceValidation?: boolean
  onChange?(value: (value: ControllerValue) => ControllerValue): void
  value: unknown
  itemValue: ControllerValue
}) {
  return (
    <field.views.Field
      field={field.controller}
      autoFocus={autoFocus}
      forceValidation={forceValidation}
      onChange={useMemo(() => {
        if (onChange === undefined) return undefined
        return (value: ControllerValue[string]) => {
          onChange(itemValue => ({
            ...itemValue,
            [field.controller.path]: value
          }))
        }
      }, [onChange, field.controller.path])}
      value={value}
      itemValue={itemValue}
    />
  )
})

export function Fields ({
  groups = [],
  fields,
  forceValidation,
  invalidFields,
  onChange,
  value: itemValue,
  mode = 'item',
  position = 'form',
}: {
  groups?: FieldGroupMeta[]
  fields: Record<string, FieldMeta>
  forceValidation: boolean
  invalidFields: ReadonlySet<string>
  onChange (value: (value: ControllerValue) => ControllerValue): void
  value: ControllerValue
  mode?: 'create' | 'item' | 'list',
  position?: 'form' | 'sidebar'
}) {
  const renderedFields = Object.fromEntries(
    Object.keys(fields).map((fieldKey, index) => {
      const field = fields[fieldKey]
      const fieldValue = itemValue[fieldKey]
      const fieldMode = mode === 'create' ? field.createView.fieldMode : mode === 'item' ? field.itemView.fieldMode : field.listView.fieldMode ?? 'edit'
      const fieldPosition = mode === 'item' ? field.itemView.fieldPosition : 'form'
      if (fieldMode === 'hidden') return [fieldKey, null]
      if (fieldPosition !== position) return [fieldKey, null]
      return [
        fieldKey,
        <RenderField
          key={fieldKey}
          field={field}
          autoFocus={index === 0}
          forceValidation={forceValidation && invalidFields.has(fieldKey)}
          onChange={fieldMode === 'edit' ? onChange : undefined}
          value={fieldValue}
          itemValue={itemValue}
        />
      ]
    })
  )
  const rendered: ReactNode[] = []
  const fieldGroups = new Map<string, { rendered: boolean, group: FieldGroupMeta }>()
  for (const group of groups) {
    const state = { group, rendered: false }
    for (const field of group.fields) {
      fieldGroups.set(field.path, state)
    }
  }
  for (const field of Object.values(fields)) {
    const fieldKey = field.path
    if (fieldGroups.has(fieldKey)) {
      const groupState = fieldGroups.get(field.path)!
      if (groupState.rendered) {
        continue
      }
      groupState.rendered = true
      const { group } = groupState
      const renderedFieldsInGroup = group.fields.map(field => renderedFields[field.path])
      if (renderedFieldsInGroup.every(field => field === null)) {
        continue
      }
      rendered.push(
        <FieldGroup label={group.label} description={group.description}>
          {renderedFieldsInGroup}
        </FieldGroup>
      )
      continue
    }
    if (renderedFields[fieldKey] === null) {
      continue
    }
    rendered.push(renderedFields[fieldKey])
  }

  return (
    <Stack gap="xlarge">
      {rendered.length === 0 ? 'There are no fields that you can read or edit' : rendered}
    </Stack>
  )
}

function FieldGroup (props: { label: string, description: string | null, children: ReactNode }) {
  const descriptionId = useId()
  const labelId = useId()
  const theme = useTheme()
  const buttonSize = 24
  const { useButtonStyles, useButtonTokens, defaults } = useContext(ButtonContext)
  const buttonStyles = useButtonStyles({ tokens: useButtonTokens(defaults) })
  const divider = (
    <div
      css={{
        height: '100%',
        width: 2,
        backgroundColor: theme.colors.border,
      }}
    />
  )
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={props.description === null ? undefined : descriptionId}
    >
      <details open>
        <summary
          css={{ listStyle: 'none', outline: 0, '::-webkit-details-marker': { display: 'none' } }}
        >
          <Stack across gap="medium">
            <div // this is a div rather than a button because the interactive element here is the <summary> above
              css={{
                ...buttonStyles,
                'summary:focus &': buttonStyles[':focus'],
                padding: 0,
                height: buttonSize,
                width: buttonSize,
                'details[open] &': {
                  transform: 'rotate(90deg)',
                },
              }}
            >
              {downChevron}
            </div>
            {divider}
            <Text id={labelId} size="large" weight="bold" css={{ position: 'relative' }}>
              {props.label}
            </Text>
          </Stack>
        </summary>
        <div css={{ display: 'flex' }}>
          <div css={{ display: 'flex' }}>
            <Stack across gap="medium">
              <div css={{ width: buttonSize }} />
              {divider}
            </Stack>
          </div>
          <Stack marginLeft="medium" css={{ width: '100%' }}>
            {props.description !== null && (
              <FieldDescription id={descriptionId}>{props.description}</FieldDescription>
            )}
            <Stack marginTop="large" gap="xlarge">
              {props.children}
            </Stack>
          </Stack>
        </div>
      </details>
    </div>
  )
}

const downChevron = (
  <svg width="16" height="16" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 3L8.75 6L5 9L5 3Z" fill="currentColor" />
  </svg>
)
