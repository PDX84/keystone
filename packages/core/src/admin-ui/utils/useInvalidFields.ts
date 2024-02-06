import { useMemo } from 'react'
import { getInvalidFields } from './serialization'

import {
  type FieldMeta,
  type ControllerValue
} from '../../types'

export function useInvalidFields (
  fields: Record<string, FieldMeta>,
  value: ControllerValue
): ReadonlySet<string> {
  return useMemo(() => getInvalidFields(fields, value), [fields, value])
}
