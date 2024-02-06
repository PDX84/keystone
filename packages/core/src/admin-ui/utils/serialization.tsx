import {
  type ControllerValue,
  type GraphQLValue,
  type FieldMeta
} from '../../types'

export {
  type ControllerValue,
  type GraphQLValue
} from '../../types'

export function getDefaultControllerValue (
  fields: Record<string, FieldMeta>,
) {
  const defaults: GraphQLValue = {}
  for (const field of Object.values(fields)) {
    defaults[field.path] = field.controller.defaultValue as any
  }

  return graphQLValueToController(fields, defaults)
}

export function getInvalidFields (
  fields: Record<string, FieldMeta>,
  value: ControllerValue
): ReadonlySet<string> {
  const invalidFields = new Set<string>()

  for (const [fieldKey, field] of Object.entries(fields)) {
    const fieldValue = value[fieldKey]
    const validateFn = field.controller.validate
    if (validateFn) {
      const result = validateFn(fieldValue)
      if (result === false) {
        invalidFields.add(fieldKey)
      }
    }
  }

  return invalidFields
}

// TODO: revert to deserializeValue naming?
export function graphQLValueToController (
  fields: Record<string, FieldMeta>,
  value: GraphQLValue
) {
  const result: ControllerValue = {}
  for (const [fieldKey, field] of Object.entries(fields)) {
    result[fieldKey] = field.controller.deserialize(value[fieldKey])
  }
  return result
}

// TODO: revert to serializeValueToObjByFieldKey naming?
export function controllerToGraphQLValue (
  fields: Record<string, FieldMeta>,
  state: ControllerValue
) {
  const result: GraphQLValue = {}
  for (const [fieldKey, field] of Object.entries(fields)) {
    result[fieldKey] = field.controller.serialize(state[fieldKey])?.[fieldKey]
  }
  return result
}
