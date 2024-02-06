/** @jsxRuntime classic */
/** @jsx jsx */

import { Box, jsx } from '@keystone-ui/core'
import { Button } from '@keystone-ui/button'
import { useRouter } from 'next/router'
import { Fields } from '../../../../admin-ui/utils'
import { PageContainer } from '../../../../admin-ui/components/PageContainer'
import { useList } from '../../../../admin-ui'
import { GraphQLErrorNotice } from '../../../../admin-ui/components'
import { useCreateItem } from '../../../../admin-ui/utils/useCreateItem'
import { BaseToolbar, ColumnLayout, ItemPageHeader } from '../ItemPage/common'

type CreateItemPageProps = { listKey: string }

export const getCreateItemPage = (props: CreateItemPageProps) => () =>
  <CreateItemPage {...props} />

function CreateItemPage (props: CreateItemPageProps) {
  const list = useList(props.listKey)
  const createItem = useCreateItem(list)
  const router = useRouter()

  return (
    <PageContainer
      title={`Create ${list.singular}`}
      header={<ItemPageHeader list={list} label="Create" />}
    >
      <ColumnLayout>
        <Box>
          <Box paddingTop="xlarge">
            {createItem.error && (
              <GraphQLErrorNotice
                networkError={createItem.error?.networkError}
                errors={createItem.error?.graphQLErrors}
              />
            )}

            <Fields {...createItem.props} />
            <BaseToolbar>
              <Button
                isLoading={createItem.state === 'loading'}
                weight="bold"
                tone="active"
                onClick={async () => {
                  const item = await createItem.create()
                  if (item) {
                    router.push(`/${list.path}/${item.id}`)
                  }
                }}
              >
                Create {list.singular}
              </Button>
            </BaseToolbar>
          </Box>
        </Box>
      </ColumnLayout>
    </PageContainer>
  )
}
