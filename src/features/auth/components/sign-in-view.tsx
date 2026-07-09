import { cn } from '@/lib/utils';
import UserAuthForm from './user-auth-form';
import { InteractiveGridPattern } from './interactive-grid';

export default function SignInViewPage() {
  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-sidebar' />
        <div className='text-sidebar-foreground relative z-20 flex items-center text-lg font-medium'>
          管理后台架构
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
        <div className='text-sidebar-foreground relative z-20 mt-auto'>
          <p className='max-w-md text-sm leading-6 text-sidebar-foreground/75'>
            使用本地账号登录后，系统会基于员工、角色、菜单和权限码加载当前工作台能力。
          </p>
        </div>
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center gap-6 sm:w-[350px]'>
          <div className='flex flex-col gap-2 text-center'>
            <h1 className='text-2xl font-semibold tracking-tight'>登录工作台</h1>
            <p className='text-muted-foreground text-sm'>使用管理员分配的用户名和密码登录。</p>
          </div>
          <UserAuthForm />
        </div>
      </div>
    </div>
  );
}
