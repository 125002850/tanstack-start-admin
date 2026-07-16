import * as React from 'react';
import { useTheme } from 'next-themes';
import { Icons } from '@/components/icons';
import { useOptionalThemeConfig } from '@/components/themes/active-theme';
import { DEFAULT_THEME } from '@/components/themes/theme.config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DefaultErrorCode = '403' | '404' | '500';
type ErrorIllustrationFamily = 'botanical' | 'monochrome' | 'zen' | 'brutal' | 'astro';
type ErrorIllustrationColorMode = 'light' | 'dark';

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

const ERROR_ILLUSTRATION_MODULES = import.meta.glob<string>(
  [
    '/src/assets/empty-state-40[34].webp',
    '/src/assets/empty-state-500.webp',
    '/src/assets/empty-state-botanical-dark-*.webp',
    '/src/assets/empty-state-monochrome-*.webp',
    '/src/assets/empty-state-zen-*.webp',
    '/src/assets/empty-state-brutal-*.webp',
    '/src/assets/empty-state-astro-v2-*.webp'
  ],
  {
    query: '?url',
    import: 'default'
  }
);

const ERROR_ILLUSTRATION_PATH: Record<ErrorIllustrationFamily, Record<DefaultErrorCode, string>> = {
  botanical: {
    '403': '/src/assets/empty-state-403.webp',
    '404': '/src/assets/empty-state-404.webp',
    '500': '/src/assets/empty-state-500.webp'
  },
  monochrome: {
    '403': '/src/assets/empty-state-monochrome-403.webp',
    '404': '/src/assets/empty-state-monochrome-404.webp',
    '500': '/src/assets/empty-state-monochrome-500.webp'
  },
  zen: {
    '403': '/src/assets/empty-state-zen-403.webp',
    '404': '/src/assets/empty-state-zen-404.webp',
    '500': '/src/assets/empty-state-zen-500.webp'
  },
  brutal: {
    '403': '/src/assets/empty-state-brutal-403.webp',
    '404': '/src/assets/empty-state-brutal-404.webp',
    '500': '/src/assets/empty-state-brutal-500.webp'
  },
  astro: {
    '403': '/src/assets/empty-state-astro-v2-403.webp',
    '404': '/src/assets/empty-state-astro-v2-404.webp',
    '500': '/src/assets/empty-state-astro-v2-500.webp'
  }
};

const ERROR_ILLUSTRATION_DARK_PATH: Partial<
  Record<ErrorIllustrationFamily, Record<DefaultErrorCode, string>>
> = {
  botanical: {
    '403': '/src/assets/empty-state-botanical-dark-403.webp',
    '404': '/src/assets/empty-state-botanical-dark-404.webp',
    '500': '/src/assets/empty-state-botanical-dark-500.webp'
  }
};

const THEME_ILLUSTRATION_FAMILY: Record<string, ErrorIllustrationFamily> = {
  claude: 'zen',
  neobrutualism: 'brutal',
  supabase: 'botanical',
  vercel: 'monochrome',
  mono: 'monochrome',
  notebook: 'zen',
  'light-green': 'botanical',
  zen: 'zen',
  'astro-vista': 'astro',
  whatsapp: 'botanical'
};

const ILLUSTRATION_FRAME_CLASS_NAME: Record<ErrorIllustrationFamily, string> = {
  botanical:
    'before:absolute before:inset-x-[16%] before:inset-y-[20%] before:-z-10 before:rounded-full before:bg-primary/8 before:blur-3xl dark:before:bg-primary/12',
  monochrome:
    'before:absolute before:inset-x-[18%] before:inset-y-[22%] before:-z-10 before:rounded-full before:bg-muted/70 before:blur-3xl dark:before:bg-muted/30',
  zen: 'before:absolute before:inset-x-[18%] before:inset-y-[22%] before:-z-10 before:rounded-full before:bg-accent/45 before:blur-3xl dark:before:bg-accent/20',
  brutal:
    'before:absolute before:inset-x-[16%] before:inset-y-[18%] before:-z-10 before:rounded-full before:bg-card/70 before:blur-3xl dark:before:bg-card/35',
  astro:
    'before:absolute before:inset-x-[14%] before:inset-y-[18%] before:-z-10 before:rounded-full before:bg-primary/8 before:blur-3xl dark:before:bg-primary/15'
};

const ILLUSTRATION_IMAGE_CLASS_NAME: Record<ErrorIllustrationFamily, string> = {
  botanical:
    'contrast-[1.08] saturate-[1.08] drop-shadow-[0_16px_22px_color-mix(in_oklab,var(--foreground)_10%,transparent)] dark:brightness-90 dark:saturate-[0.9]',
  monochrome:
    'drop-shadow-[0_16px_20px_color-mix(in_oklab,var(--foreground)_12%,transparent)] dark:brightness-95',
  zen: 'drop-shadow-[0_16px_20px_color-mix(in_oklab,var(--foreground)_10%,transparent)] dark:brightness-95',
  brutal:
    'drop-shadow-[0_16px_18px_color-mix(in_oklab,var(--foreground)_16%,transparent)] dark:drop-shadow-[0_0_1px_color-mix(in_oklab,var(--foreground)_38%,transparent)]',
  astro:
    'contrast-[1.06] saturate-[1.08] drop-shadow-[0_18px_24px_color-mix(in_oklab,var(--primary)_16%,transparent)]'
};

const ILLUSTRATION_SCALE_CLASS_NAME: Record<
  ErrorIllustrationFamily,
  Record<DefaultErrorCode, string>
> = {
  botanical: { '403': 'scale-100', '404': 'scale-[1.08]', '500': 'scale-[1.06]' },
  monochrome: { '403': 'scale-[1.04]', '404': 'scale-[0.98]', '500': 'scale-[1.08]' },
  zen: { '403': 'scale-100', '404': 'scale-[0.92]', '500': 'scale-[0.96]' },
  brutal: { '403': 'scale-[0.96]', '404': 'scale-[0.94]', '500': 'scale-[0.92]' },
  astro: { '403': 'scale-100', '404': 'scale-[1.08]', '500': 'scale-[0.95]' }
};

type ErrorIllustrationProps = {
  code: DefaultErrorCode;
  family: ErrorIllustrationFamily;
  colorMode: ErrorIllustrationColorMode;
};

function getDocumentActiveTheme() {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
}

function resolveErrorIllustrationFamily(theme: string) {
  return THEME_ILLUSTRATION_FAMILY[theme] ?? 'monochrome';
}

function getDocumentColorMode(): ErrorIllustrationColorMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function loadErrorIllustrationUrl(
  code: DefaultErrorCode,
  family: ErrorIllustrationFamily,
  colorMode: ErrorIllustrationColorMode
) {
  const path =
    (colorMode === 'dark' ? ERROR_ILLUSTRATION_DARK_PATH[family]?.[code] : undefined) ??
    ERROR_ILLUSTRATION_PATH[family][code];
  return ERROR_ILLUSTRATION_MODULES[path]?.();
}

function ErrorIllustrationImage({ code, family, colorMode }: ErrorIllustrationProps) {
  const [src, setSrc] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    setSrc(undefined);

    void loadErrorIllustrationUrl(code, family, colorMode)
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
  }, [code, colorMode, family]);

  return (
    <div
      className={cn(
        'relative isolate mx-auto aspect-[3/2] w-full max-w-[34rem]',
        ILLUSTRATION_FRAME_CLASS_NAME[family]
      )}
    >
      <img
        alt=''
        aria-hidden='true'
        className={cn(
          'size-full object-contain transition-[filter,transform] duration-300',
          ILLUSTRATION_IMAGE_CLASS_NAME[family],
          ILLUSTRATION_SCALE_CLASS_NAME[family][code]
        )}
        data-error-illustration={code}
        data-error-illustration-family={family}
        data-error-illustration-mode={colorMode}
        data-testid='default-error-illustration'
        src={src}
      />
      {family === 'astro' && (
        <span
          aria-hidden='true'
          className='border-primary/30 bg-background/90 text-foreground/70 absolute right-[14%] bottom-[13%] rounded-full border px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-[0.16em] shadow-sm backdrop-blur-sm'
        >
          HTTP {code}
        </span>
      )}
    </div>
  );
}

function ErrorIllustration({ code }: { code: DefaultErrorCode }) {
  const themeConfig = useOptionalThemeConfig();
  const { resolvedTheme } = useTheme();
  const family = resolveErrorIllustrationFamily(
    themeConfig?.activeTheme ?? getDocumentActiveTheme()
  );
  const colorMode = resolvedTheme === 'dark' ? 'dark' : getDocumentColorMode();

  return <ErrorIllustrationImage code={code} family={family} colorMode={colorMode} />;
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
        <p className='sr-only'>HTTP 错误代码：{code}</p>
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
