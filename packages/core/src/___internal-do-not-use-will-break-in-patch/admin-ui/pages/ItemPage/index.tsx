/** @jsxRuntime classic */
/** @jsx jsx */

import copyToClipboard from 'clipboard-copy'
import { useRouter } from 'next/router'
import {
  Fragment,
  type HTMLAttributes,
  memo,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Button } from '@keystone-ui/button'
import { Box, Center, Stack, Text, jsx, useTheme } from '@keystone-ui/core'
import { LoadingDots } from '@keystone-ui/loading'
import { ClipboardIcon } from '@keystone-ui/icons/icons/ClipboardIcon'
import { AlertDialog } from '@keystone-ui/modals'
import { Notice } from '@keystone-ui/notice'
import { useToasts } from '@keystone-ui/toast'
import { Tooltip } from '@keystone-ui/tooltip'
import { FieldLabel, TextInput } from '@keystone-ui/fields'
import { type ListMeta } from '../../../../types'
import {
  type ItemData,
  useInvalidFields,
  Fields,
  useChangedFieldsAndDataForUpdate,
} from '../../../../admin-ui/utils'

import { gql, useMutation, useQuery } from '../../../../admin-ui/apollo'
import { useList } from '../../../../admin-ui/context'
import { PageContainer, HEADER_HEIGHT } from '../../../../admin-ui/components/PageContainer'
import { GraphQLErrorNotice } from '../../../../admin-ui/components/GraphQLErrorNotice'
import { usePreventNavigation } from '../../../../admin-ui/utils/usePreventNavigation'
import { CreateButtonLink } from '../../../../admin-ui/components/CreateButtonLink'
import { BaseToolbar, ColumnLayout, ItemPageHeader } from './common'

type ItemPageProps = {
  listKey: string
}

function useEventCallback<Func extends (...args: any) => any>(callback: Func): Func {
  const callbackRef = useRef(callback)
  const cb = useCallback((...args: any[]) => {
    return callbackRef.current(...args)
  }, [])
  useEffect(() => {
    callbackRef.current = callback
  })
  return cb as any
}

function ItemForm ({
  list,
  item: initialItemState,
  showDelete,
}: {
  list: ListMeta
  item: ItemData
  showDelete: boolean
}) {
  const { spacing, typography } = useTheme()
  const toasts = useToasts()

  const [update, { loading, error }] = useMutation(
    gql`mutation ($data: ${list.gqlNames.updateInputName}!, $id: ID!) {
      item: ${list.gqlNames.updateMutationName}(where: { id: $id }, data: $data) {
        id
      }
    }`,
    {
      refetchQueries: ['ItemPage']
    }
  )

  const [itemState, setItemState] = useState(initialItemState)
  const [forceValidation, setForceValidation] = useState(false)
  const invalidFields = new Set<string>() // TODO // useInvalidFields(list.fields, state.value)
  const onSave = useCallback(async () => {
    const newForceValidation = invalidFields.size !== 0
    setForceValidation(newForceValidation)
    if (newForceValidation) return

    const { errors } = await update({
      variables: {
        id: initialItemState.id,
        data: itemState,
      }
    })

    const error = errors?.find(x => x.path === undefined || x.path?.length === 1)
    if (error) {
      toasts.addToast({
        title: 'Failed to update item',
        tone: 'negative',
        message: error.message,
      })
    } else {
      toasts.addToast({
        title: 'Saved successfully',
        tone: 'positive',
      })
    }
  }, [initialItemState, itemState, invalidFields, update])

  const itemId = `${initialItemState?.id}`
  const label = `${list.isSingleton ? list.label : initialItemState?.[list.labelField] ?? itemId}`
  const hasChangedFields = true // TODO
  usePreventNavigation(useMemo(() => ({ current: hasChangedFields }), [hasChangedFields]))

  return (
    <Fragment>
      <Box marginTop="xlarge">
        <GraphQLErrorNotice networkError={error?.networkError} errors={error?.graphQLErrors} />
        <Fields
          groups={list.groups}
          fields={list.fields}
          forceValidation={forceValidation}
          invalidFields={invalidFields}
          onChange={useCallback(values => void setItemState(values), [setItemState])}
          value={itemState}
          position="form"
        />
        <Toolbar
          onSave={onSave}
          hasChangedFields={hasChangedFields}
          onReset={useEventCallback(() => void setItemState(itemState))}
          loading={loading}
          deleteButton={useMemo(
            () =>
              showDelete ? (
                <DeleteButton
                  list={list}
                  itemLabel={label}
                  itemId={itemId}
                />
              ) : undefined,
            [showDelete, list, label, itemId]
          )}
        />
      </Box>
      <StickySidebar>
        <FieldLabel>Item ID</FieldLabel>
        <div
          css={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <TextInput
            css={{
              marginRight: spacing.medium,
              fontFamily: typography.fontFamily.monospace,
              fontSize: typography.fontSize.small,
            }}
            readOnly
            value={itemId}
          />
          <Tooltip content="Copy ID">
            {props => (
              <Button {...props} aria-label="Copy ID" onClick={() => void copyToClipboard(itemId)}>
                <ClipboardIcon size="small" />
              </Button>
            )}
          </Tooltip>
        </div>
        <Box marginTop="xlarge">
          <Fields
            groups={list.groups}
            fields={list.fields}
            forceValidation={forceValidation}
            invalidFields={invalidFields}
            onChange={useCallback(values => void setItemState(values), [setItemState])}
            value={itemState}
            position="sidebar"
          />
        </Box>
      </StickySidebar>
    </Fragment>
  )
}

function DeleteButton ({
  itemLabel,
  itemId,
  list,
}: {
  itemLabel: string
  itemId: string
  list: ListMeta
}) {
  const toasts = useToasts()
  const [deleteItem, { loading }] = useMutation(
    gql`mutation ($id: ID!) {
      ${list.gqlNames.deleteMutationName}(where: { id: $id }) {
        id
      }
    }`,
    { variables: { id: itemId } }
  )
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  return (
    <Fragment>
      <Button
        tone="negative"
        onClick={() => {
          setIsOpen(true)
        }}
      >
        Delete
      </Button>
      <AlertDialog
        // TODO: change the copy in the title and body of the modal
        title="Delete Confirmation"
        isOpen={isOpen}
        tone="negative"
        actions={{
          confirm: {
            label: 'Delete',
            action: async () => {
              try {
                await deleteItem()
              } catch (err: any) {
                return toasts.addToast({
                  title: `Failed to delete ${list.singular} item: ${itemLabel}`,
                  message: err.message,
                  tone: 'negative',
                })
              }
              router.push(list.isSingleton ? '/' : `/${list.path}`)
              return toasts.addToast({
                title: itemLabel,
                message: `Deleted ${list.singular} item successfully`,
                tone: 'positive',
              })
            },
            loading,
          },
          cancel: {
            label: 'Cancel',
            action: () => {
              setIsOpen(false)
            },
          },
        }}
      >
        Are you sure you want to delete <strong>{itemLabel}</strong>?
      </AlertDialog>
    </Fragment>
  )
}

export const getItemPage = (props: ItemPageProps) => () => <ItemPage {...props} />

function ItemPage ({ listKey }: ItemPageProps) {
  const list = useList(listKey)
  const id = useRouter().query.id as string
  const selectedFields = Object.entries(list.fields)
    .filter(([fieldKey, field]) => {
      if (fieldKey === 'id') return true
      return field.itemView.fieldMode !== 'hidden'
    })
    .map(([fieldKey]) => list.fields[fieldKey].controller.graphqlSelection)
    .join('\n')

  const { data, error, loading } = useQuery(gql`
    query ItemPage($id: ID!) {
      item: ${list.gqlNames.itemQueryName}(where: {id: $id}) {
        ${selectedFields}
      }
    }
  `, {
    variables: { id }
  })

  const item = data?.item ?? null
  const pageTitle = list.isSingleton ? list.label : (item?.[list.labelField] ?? item?.id) ?? id
  return (
    <PageContainer
      title={pageTitle}
      header={
        <ItemPageHeader
          list={list}
          label={loading ? 'Loading...' : pageTitle}
        />
      }
    >
      {loading ? (
        <Center css={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
          <LoadingDots label="Loading item data" size="large" tone="passive" />
        </Center>
      ) : (
        <ColumnLayout>
          {data?.item == null ? (
            <Box marginY="xlarge">
              {error ? (
                <GraphQLErrorNotice
                  errors={error?.graphQLErrors}
                  networkError={error?.networkError}
                />
              ) : list.isSingleton ? (
                id === '1' ? (
                  <Stack gap="medium">
                    <Notice tone="negative">
                      {list.label} doesn't exist or you don't have access to it.
                    </Notice>
                    {list.hideCreate && <CreateButtonLink list={list} />}
                  </Stack>
                ) : (
                  <Notice tone="negative">The item with id "{id}" does not exist</Notice>
                )
              ) : (
                <Notice tone="negative">
                  The item with id "{id}" could not be found or you don't have access to it.
                </Notice>
              )}
            </Box>
          ) : (
            <ItemForm
              list={list}
              item={data.item}
              showDelete={!list.hideDelete}
            />
          )}
        </ColumnLayout>
      )}
    </PageContainer>
  )
}

// Styled Components
// ------------------------------

const Toolbar = memo(function Toolbar ({
  hasChangedFields,
  loading,
  onSave,
  onReset,
  deleteButton,
}: {
  hasChangedFields: boolean
  loading: boolean
  onSave: () => void
  onReset: () => void
  deleteButton?: ReactElement
}) {
  return (
    <BaseToolbar>
      <Button
        isDisabled={!hasChangedFields}
        isLoading={loading}
        weight="bold"
        tone="active"
        onClick={onSave}
      >
        Save changes
      </Button>
      <Stack align="center" across gap="small">
        {hasChangedFields ? (
          <ResetChangesButton onReset={onReset} />
        ) : (
          <Text weight="medium" paddingX="large" color="neutral600">
            No changes
          </Text>
        )}
        {deleteButton}
      </Stack>
    </BaseToolbar>
  )
})

function ResetChangesButton (props: { onReset: () => void }) {
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false)

  return (
    <Fragment>
      <Button
        weight="none"
        onClick={() => {
          setConfirmModalOpen(true)
        }}
      >
        Reset changes
      </Button>
      <AlertDialog
        actions={{
          confirm: {
            action: () => props.onReset(),
            label: 'Reset changes',
          },
          cancel: {
            action: () => setConfirmModalOpen(false),
            label: 'Cancel',
          },
        }}
        isOpen={isConfirmModalOpen}
        title="Are you sure you want to reset changes?"
        tone="negative"
      >
        {null}
      </AlertDialog>
    </Fragment>
  )
}

function StickySidebar (props: HTMLAttributes<HTMLDivElement>) {
  const { spacing } = useTheme()
  return (
    <div
      css={{
        marginTop: spacing.xlarge,
        marginBottom: spacing.xxlarge,
        position: 'sticky',
        top: spacing.xlarge,
      }}
      {...props}
    />
  )
}
