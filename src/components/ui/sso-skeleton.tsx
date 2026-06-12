import { cn } from '@/lib/utils';

function SsoSkeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sso-skeleton'
      className={cn('relative overflow-hidden rounded-md', className)}
      {...props}
    >
      <div className='bg-muted absolute inset-0' />
      <div className='bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent animate-pulse absolute inset-0' />
    </div>
  );
}

function SsoAvatarSkeleton({
  size = 32,
  className
}: {
  size?: number;
  className?: string;
}) {
  return (
    <SsoSkeleton
      className={cn('rounded-full', className)}
      style={{ width: size, height: size }}
    />
  );
}

function SsoTextSkeleton({
  width = '100%',
  className
}: {
  width?: string;
  className?: string;
}) {
  return (
    <SsoSkeleton className={cn('h-4', className)} style={{ width }} />
  );
}

function SsoMenuSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className='space-y-2 px-2'>
      {Array.from({ length: count }).map((_, i) => (
        <SsoTextSkeleton
          key={i}
          width={`${60 + (i * 7) % 35}%`}
          className='h-8'
        />
      ))}
    </div>
  );
}

export { SsoSkeleton, SsoAvatarSkeleton, SsoTextSkeleton, SsoMenuSkeleton };
