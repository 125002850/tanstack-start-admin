import * as React from 'react';
import { Icons } from '@/components/icons';
import { useOptionalThemeConfig } from '@/components/themes/active-theme';
import { DEFAULT_THEME } from '@/components/themes/theme.config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DefaultErrorCode = '403' | '404' | '500';
type ErrorIllustrationFamily = 'botanical' | 'minimal' | 'zen' | 'brutal' | 'astro';

type ErrorAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

interface DefaultErrorPageProps {
  code: DefaultErrorCode;
  title: string;
  description: string;
  alertTitle: string;
  alertDescription: string;
  action?: ErrorAction;
  className?: string;
}

const ERROR_STYLE: Record<
  DefaultErrorCode,
  {
    accent: string;
    badge: string;
    glow: string;
    alert: string;
    icon: string;
  }
> = {
  '403': {
    accent: 'bg-destructive',
    badge: 'border-destructive/25 bg-destructive/10 text-destructive',
    glow: 'text-destructive',
    alert: 'border-destructive/25 bg-destructive/5',
    icon: 'text-destructive'
  },
  '404': {
    accent: 'bg-muted-foreground/35',
    badge: 'border-border bg-muted text-muted-foreground',
    glow: 'text-muted-foreground',
    alert: 'border-border bg-card',
    icon: 'text-muted-foreground'
  },
  '500': {
    accent: 'bg-destructive',
    badge: 'border-destructive/25 bg-destructive/10 text-destructive',
    glow: 'text-destructive',
    alert: 'border-destructive/25 bg-destructive/5',
    icon: 'text-destructive'
  }
};

const ERROR_ILLUSTRATION_MODULES = import.meta.glob<string>('/src/assets/empty-state-*.png', {
  query: '?url',
  import: 'default'
});

const ERROR_ILLUSTRATION_PATH: Record<ErrorIllustrationFamily, Record<DefaultErrorCode, string>> = {
  botanical: {
    '403': '/src/assets/empty-state-403.png',
    '404': '/src/assets/empty-state-404.png',
    '500': '/src/assets/empty-state-500.png'
  },
  minimal: {
    '403': '/src/assets/empty-state-minimal-403.png',
    '404': '/src/assets/empty-state-minimal-404.png',
    '500': '/src/assets/empty-state-minimal-500.png'
  },
  zen: {
    '403': '/src/assets/empty-state-zen-403.png',
    '404': '/src/assets/empty-state-zen-404.png',
    '500': '/src/assets/empty-state-zen-500.png'
  },
  brutal: {
    '403': '/src/assets/empty-state-brutal-403.png',
    '404': '/src/assets/empty-state-brutal-404.png',
    '500': '/src/assets/empty-state-brutal-500.png'
  },
  astro: {
    '403': '/src/assets/empty-state-astro-403.png',
    '404': '/src/assets/empty-state-astro-404.png',
    '500': '/src/assets/empty-state-astro-500.png'
  }
};

const THEME_ILLUSTRATION_FAMILY: Record<string, ErrorIllustrationFamily> = {
  claude: 'zen',
  neobrutualism: 'brutal',
  supabase: 'botanical',
  vercel: 'minimal',
  mono: 'minimal',
  notebook: 'zen',
  'light-green': 'botanical',
  zen: 'zen',
  'astro-vista': 'astro',
  whatsapp: 'botanical'
};

const ILLUSTRATION_CLASS_NAME = 'mx-auto aspect-[3/2] w-full max-w-[34rem] object-contain';

type ErrorIllustrationProps = {
  code: DefaultErrorCode;
  family: ErrorIllustrationFamily;
};

function getDocumentActiveTheme() {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
}

function resolveErrorIllustrationFamily(theme: string) {
  return THEME_ILLUSTRATION_FAMILY[theme] ?? 'minimal';
}

function loadErrorIllustrationUrl(code: DefaultErrorCode, family: ErrorIllustrationFamily) {
  const path = ERROR_ILLUSTRATION_PATH[family][code];
  return ERROR_ILLUSTRATION_MODULES[path]?.();
}

function ErrorIllustrationImage({ code, family }: ErrorIllustrationProps) {
  const [src, setSrc] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    setSrc(undefined);

    void loadErrorIllustrationUrl(code, family)
      ?.then((url) => {
        if (!cancelled) {
          setSrc(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, family]);

  return (
    <img
      alt=''
      aria-hidden='true'
      className={ILLUSTRATION_CLASS_NAME}
      data-error-illustration={code}
      data-error-illustration-family={family}
      data-testid='default-error-illustration'
      src={src}
    />
  );
}

function ErrorIllustration({ code }: { code: DefaultErrorCode }) {
  const themeConfig = useOptionalThemeConfig();
  const family = resolveErrorIllustrationFamily(
    themeConfig?.activeTheme ?? getDocumentActiveTheme()
  );

  return <ErrorIllustrationImage code={code} family={family} />;
}

function ErrorActionButton({ action }: { action: ErrorAction }) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className='size-4' aria-hidden={true} />}
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <Button asChild className='min-w-36 shadow-md shadow-primary/15'>
        <a href={action.href}>{content}</a>
      </Button>
    );
  }

  return (
    <Button className='min-w-36 shadow-md shadow-primary/15' onClick={action.onClick}>
      {content}
    </Button>
  );
}

export function DefaultErrorPage({
  code,
  title,
  description,
  alertTitle,
  alertDescription,
  action,
  className
}: DefaultErrorPageProps) {
  const style = ERROR_STYLE[code];

  return (
    <main
      className={cn(
        'bg-background text-foreground relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6',
        'before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-[size:56px_56px] before:opacity-25',
        'after:bg-border after:absolute after:inset-x-0 after:top-0 after:-z-10 after:h-px',
        className
      )}
    >
      <section className='flex w-full max-w-4xl flex-col items-center gap-5 text-center'>
        <div className='relative flex w-full flex-col items-center'>
          <ErrorIllustration code={code} />
        </div>

        <div className='flex flex-col items-center gap-2'>
          <h1 className='text-3xl font-semibold sm:text-4xl'>{title}</h1>
          <p className='text-muted-foreground max-w-xl text-sm leading-6 sm:text-base'>
            {description}
          </p>
        </div>

        <Alert className={cn('max-w-xl text-left shadow-sm', style.alert)}>
          <Icons.info className={cn('size-4', style.icon)} aria-hidden='true' />
          <AlertTitle>{alertTitle}</AlertTitle>
          <AlertDescription>
            <p>{alertDescription}</p>
          </AlertDescription>
        </Alert>

        {action && (
          <div className='flex w-full justify-center pt-1'>
            <ErrorActionButton action={action} />
          </div>
        )}
      </section>
    </main>
  );
}
