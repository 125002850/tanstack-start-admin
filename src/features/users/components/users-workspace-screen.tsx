import PageContainer from '@/components/layout/page-container'
import { UserFormSheetTrigger } from './user-form-sheet'
import UserListingPage from './user-listing'

export default function UsersWorkspaceScreen() {
  return (
    <PageContainer pageHeaderAction={<UserFormSheetTrigger />}>
      <UserListingPage />
    </PageContainer>
  )
}
