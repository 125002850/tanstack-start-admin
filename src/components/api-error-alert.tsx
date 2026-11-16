import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { apiErrorDetailsStore, type ApiErrorPresentation } from '@/lib/api/error-notification';

export function ApiErrorAlert({ error }: { error: ApiErrorPresentation }) {
  return (
    <Alert variant='destructive' className='items-center [&>svg]:translate-y-0'>
      <Icons.alertCircle className='size-4' />
      <div className='col-start-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
        <AlertTitle className='min-w-0 line-clamp-none break-words'>{error.summary}</AlertTitle>
        {error.summary !== error.message ? (
          <Button
            variant='outline'
            size='sm'
            onClick={() => apiErrorDetailsStore.setState({ error })}
          >
            查看详情
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}
