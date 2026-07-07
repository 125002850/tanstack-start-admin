import PageContainer from '@/components/layout/page-container';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

import { AreaGraph } from './area-graph';
import { BarGraph } from './bar-graph';
import { PieGraph } from './pie-graph';
import { RecentSales } from './recent-sales';

export function OverviewManagementPage() {
  return (
    <div className='flex flex-1 flex-col space-y-2'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold tracking-tight'>你好，欢迎回来 👋</h2>
      </div>
      <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
        <Card className='@container/card'>
          <CardHeader>
            <CardDescription>总收入</CardDescription>
            <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
              $1,250.00
            </CardTitle>
            <CardAction>
              <Badge variant='outline'>
                <Icons.trendingUp />
                +12.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className='flex-col items-start gap-1.5 text-sm'>
            <div className='line-clamp-1 flex gap-2 font-medium'>
              本月持续增长 <Icons.trendingUp className='size-4' />
            </div>
            <div className='text-muted-foreground'>过去 6 个月访客趋势</div>
          </CardFooter>
        </Card>
        <Card className='@container/card'>
          <CardHeader>
            <CardDescription>新增客户</CardDescription>
            <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
              1,234
            </CardTitle>
            <CardAction>
              <Badge variant='outline'>
                <Icons.trendingDown />
                -20%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className='flex-col items-start gap-1.5 text-sm'>
            <div className='line-clamp-1 flex gap-2 font-medium'>
              本周期下降 20% <Icons.trendingDown className='size-4' />
            </div>
            <div className='text-muted-foreground'>获客情况需要关注</div>
          </CardFooter>
        </Card>
        <Card className='@container/card'>
          <CardHeader>
            <CardDescription>活跃账户</CardDescription>
            <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
              45,678
            </CardTitle>
            <CardAction>
              <Badge variant='outline'>
                <Icons.trendingUp />
                +12.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className='flex-col items-start gap-1.5 text-sm'>
            <div className='line-clamp-1 flex gap-2 font-medium'>
              用户留存表现强劲 <Icons.trendingUp className='size-4' />
            </div>
            <div className='text-muted-foreground'>互动度超过目标</div>
          </CardFooter>
        </Card>
        <Card className='@container/card'>
          <CardHeader>
            <CardDescription>增长率</CardDescription>
            <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
              4.5%
            </CardTitle>
            <CardAction>
              <Badge variant='outline'>
                <Icons.trendingUp />
                +4.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className='flex-col items-start gap-1.5 text-sm'>
            <div className='line-clamp-1 flex gap-2 font-medium'>
              业绩稳步提升 <Icons.trendingUp className='size-4' />
            </div>
            <div className='text-muted-foreground'>达到增长预期</div>
          </CardFooter>
        </Card>
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
        <div className='col-span-4'>
          <BarGraph />
        </div>
        <div className='col-span-4 md:col-span-3'>
          <RecentSales />
        </div>
        <div className='col-span-4'>
          <AreaGraph />
        </div>
        <div className='col-span-4 min-h-0 md:col-span-3'>
          <PieGraph />
        </div>
      </div>
    </div>
  );
}

export default function OverviewScreen() {
  return (
    <PageContainer>
      <OverviewManagementPage />
    </PageContainer>
  );
}
