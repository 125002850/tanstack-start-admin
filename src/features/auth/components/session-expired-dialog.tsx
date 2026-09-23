import { useStore } from 'zustand';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from '@/components/ui/alert-dialog';
import { sessionExpiryStore } from '@/lib/api/sso/session-expiry';
import { confirmSessionExpired } from '@/lib/api/sso/session';

export function SessionExpiredDialog() {
  const { expired, redirecting } = useStore(sessionExpiryStore);
  return (
    <AlertDialog open={expired}>
      <AlertDialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>登录状态已失效</AlertDialogTitle>
          <AlertDialogDescription>请重新登录，点击确认后退出当前登录。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction disabled={redirecting} onClick={confirmSessionExpired}>
            确认
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
