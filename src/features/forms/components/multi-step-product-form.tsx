import * as React from 'react';
import { useAppForm, withFieldGroup } from '@/components/ui/tanstack-form';
import { revalidateLogic, useStore } from '@tanstack/react-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { Icons } from '@/components/icons';
import { FieldDescription } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'motion/react';
import { useFormStepper } from '@/hooks/use-stepper';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const productFormSchema = z.object({
  name: z.string().min(2, '产品名称至少需要 2 个字符'),
  category: z.string().min(1, '请选择分类'),
  price: z.number().min(0.01, '价格必须大于 0'),
  description: z.string().min(10, '描述至少需要 10 个字符')
});

const stepSchemas = [
  productFormSchema.pick({ name: true, category: true, price: true }),
  productFormSchema.pick({ description: true }),
  z.object({})
];

const categoryOptions = [
  { value: 'beauty', label: '美妆' },
  { value: 'electronics', label: '电子产品' },
  { value: 'home', label: '家居园艺' },
  { value: 'sports', label: '运动户外' }
];

const Step1Group = withFieldGroup({
  defaultValues: {
    name: '',
    category: '',
    price: undefined as number | undefined
  },
  render: function Step1Render({ group }) {
    return (
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>基本信息</h3>
        <FieldDescription>输入产品名称、分类和价格。</FieldDescription>

        <group.AppField name='name'>
          {(field) => (
            <field.TextField label='产品名称' required placeholder='请输入产品名称' />
          )}
        </group.AppField>

        <group.AppField name='category'>
          {(field) => (
            <field.SelectField
              label='分类'
              required
              options={categoryOptions}
              placeholder='请选择分类'
            />
          )}
        </group.AppField>

        <group.AppField name='price'>
          {(field) => (
            <field.TextField
              label='价格'
              required
              type='number'
              min={0}
              step={0.01}
              placeholder='请输入价格'
            />
          )}
        </group.AppField>
      </div>
    );
  }
});

const Step2Group = withFieldGroup({
  defaultValues: {
    description: ''
  },
  render: function Step2Render({ group }) {
    return (
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>详细信息</h3>
        <FieldDescription>添加详细的产品描述。</FieldDescription>

        <group.AppField name='description'>
          {(field) => (
            <field.TextareaField
              label='描述'
              required
              placeholder='请输入产品描述'
              maxLength={500}
              rows={5}
            />
          )}
        </group.AppField>
      </div>
    );
  }
});

const Step3Group = withFieldGroup({
  defaultValues: {},
  render: function Step3Render() {
    return (
      <div className='space-y-4'>
        <h3 className='text-lg font-semibold'>确认提交</h3>
        <FieldDescription>提交前请确认以下信息。</FieldDescription>
      </div>
    );
  }
});

function ReviewSummary({
  values
}: {
  values: {
    name: string;
    category: string;
    price?: number;
    description: string;
  };
}) {
  return (
    <div className='space-y-3'>
      <Separator />
      <div className='grid gap-3'>
        <div>
          <p className='text-muted-foreground text-xs font-medium uppercase'>名称</p>
          <p className='text-sm'>{values.name || '—'}</p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs font-medium uppercase'>分类</p>
          <p className='text-sm capitalize'>{values.category || '—'}</p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs font-medium uppercase'>价格</p>
          <p className='text-sm'>{values.price != null ? `¥${values.price}` : '—'}</p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs font-medium uppercase'>描述</p>
          <p className='text-sm'>{values.description || '—'}</p>
        </div>
      </div>
    </div>
  );
}

type ProductFormValues = {
  name: string;
  category: string;
  price: number | undefined;
  description: string;
};

export default function MultiStepProductForm() {
  const {
    currentValidator,
    step,
    currentStep,
    isFirstStep,
    handleCancelOrBack,
    handleNextStepOrSubmit
  } = useFormStepper(stepSchemas);

  const form = useAppForm({
    defaultValues: {
      name: '',
      category: '',
      price: undefined,
      description: ''
    } as ProductFormValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: currentValidator as typeof productFormSchema,
      onDynamicAsyncDebounceMs: 500
    },
    onSubmit: () => {
      toast.success('产品创建成功！');
    }
  });

  const isDefault = useStore(form.store, (state) => state.isDefaultValue);
  const formValues = useStore(form.store, (state) => state.values);

  const groups: Record<number, React.ReactNode> = {
    1: <Step1Group form={form} fields={{ name: 'name', category: 'category', price: 'price' }} />,
    2: <Step2Group form={form} fields={{ description: 'description' }} />,
    3: (
      <>
        <Step3Group form={form} fields={{}} />
        <ReviewSummary values={formValues} />
      </>
    )
  };

  const handleNext = async () => {
    await handleNextStepOrSubmit(form);
  };

  const current = groups[currentStep];

  return (
    <form.AppForm>
      <form.Form className='p-0 md:p-0'>
        <div className='flex flex-col gap-2 pt-3'>
          <div className='flex flex-col items-center justify-start gap-1'>
            <span className='text-muted-foreground text-sm'>
              第 {currentStep} 步 / 共 {Object.keys(groups).length} 步
            </span>
            <Progress value={(currentStep / Object.keys(groups).length) * 100} />
          </div>

          <AnimatePresence mode='popLayout'>
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.4, type: 'spring' }}
              className='flex flex-col gap-2'
            >
              {current}
            </motion.div>
          </AnimatePresence>

          <div className='flex w-full items-center justify-between gap-3 pt-3'>
            <form.StepButton
              label={
                <>
                  <Icons.chevronLeft /> 上一步
                </>
              }
              disabled={isFirstStep}
              handleMovement={() =>
                handleCancelOrBack({
                  onBack: () => {}
                })
              }
            />
            {step.isCompleted ? (
              <div className='flex w-full items-center justify-end gap-3 pt-3'>
                {!isDefault && (
                  <Button
                    type='button'
                    onClick={() => form.reset()}
                    className='rounded-lg'
                    variant='outline'
                    size='sm'
                  >
                    重置
                  </Button>
                )}
                <form.SubmitButton>提交</form.SubmitButton>
              </div>
            ) : (
              <div className='flex w-full items-center justify-end gap-3 pt-3'>
                {!isDefault && (
                  <Button
                    type='button'
                    onClick={() => form.reset()}
                    className='rounded-lg'
                    variant='outline'
                    size='sm'
                  >
                    重置
                  </Button>
                )}
                <form.StepButton
                  label={
                    <>
                      下一步 <Icons.chevronRight />
                    </>
                  }
                  handleMovement={handleNext}
                />
              </div>
            )}
          </div>
        </div>
      </form.Form>
    </form.AppForm>
  );
}
