import { useRef } from 'react';
import { useStore } from 'zustand';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { apiErrorDetailsStore } from '@/lib/api/error-notification';
import { copyTextToClipboard } from '@/lib/browser/copy-text-to-clipboard';

export function ApiErrorDetailsDialog() {
  const error = useStore(apiErrorDetailsStore, (state) => state.error);
  const contentRef = useRef<HTMLDivElement>(null);
  if (error === null) return null;

  const copyDetails = async () => {
    const copied = await copyTextToClipboard(`错误码：${error.code}\n${error.message}`, {
      container: contentRef.current
    });
    if (copied) toast.success('已复制错误详情');
    else toast.error('复制失败，请手动选择文本。');
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) apiErrorDetailsStore.setState({ error: null });
      }}
    >
      <DialogContent ref={contentRef} className='flex max-h-[80dvh] flex-col sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{error.summary}</DialogTitle>
          <DialogDescription>错误码：{error.code}</DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
          <p className='text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere'>
            {error.message}
          </p>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={copyDetails}>
            <Icons.copy className='size-4' />
            复制详情
          </Button>
          <DialogClose asChild>
            <Button>关闭</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
