import { describe, expect, it } from 'vitest';
import {
  convertConditionRightValue,
  createInputCondition,
  getConditionOperands
} from './condition-operands';
import { validateConditionTree } from './condition-validation';
import type { PredicateCondition } from '../model/condition-model';

const legacy: PredicateCondition = {
  clientId: 'leaf',
  type: 'CONDITION',
  field: 'payload.a',
  operator: 'EQ',
  value: ''
};
const fields = [
  { path: 'payload.a', label: '金额', source: 'PAYLOAD', type: 'STRING', expression: '$json.a' },
  { path: 'payload.b', label: '阈值', source: 'PAYLOAD', type: 'STRING', expression: '$json.b' }
] as const;
describe('条件输入原文与兼容转换', () => {
  it.each([
    ['EQ', 'IN', '1', '["1"]'],
    ['EQ', 'NOT_IN', '001', '["001"]'],
    ['NUM_EQ', 'NUM_IN', '100.000000000000000001', '["100.000000000000000001"]'],
    ['NUM_EQ', 'NUM_NOT_IN', '9007199254740993', '["9007199254740993"]'],
    ['EQ', 'IN', '"true"', '["true"]'],
    ['EQ', 'IN', 'false', '[false]'],
    ['EQ', 'IN', '{{ $json.expected }}', '["{{ $json.expected }}"]'],
    ['IN', 'EQ', '["001","002"]', '001'],
    ['NOT_IN', 'NE', '["true","false"]', '"true"'],
    ['IN', 'EQ', '["[1,2]","other"]', '"[1,2]"'],
    ['IN', 'EQ', '["{{ $json.expected }}","other"]', '{{ $json.expected }}'],
    ['NUM_IN', 'NUM_EQ', '[100.000000000000000001,2]', '100.000000000000000001'],
    ['NUM_NOT_IN', 'NUM_NE', '[9007199254740993,2]', '9007199254740993'],
    ['IN', 'EQ', '[]', ''],
    ['IN', 'NOT_IN', '["001", "002"]', '["001", "002"]'],
    ['NUM_IN', 'NUM_NOT_IN', '[1, 2]', '[1, 2]'],
    ['IN', 'EQ', '["unfinished', '["unfinished'],
    ['IN', 'EQ', '{{ $json.values }}', '{{ $json.values }}']
  ] as const)('%s 切换为 %s 时保留右值语义：%s', (previous, next, source, expected) => {
    expect(convertConditionRightValue(source, previous, next)).toBe(expected);
  });

  it('回显旧字段引用、集合与布尔值', () => {
    expect(
      getConditionOperands({ ...legacy, value: undefined, fieldRef: 'payload.b' }, fields)
    ).toEqual({ left: '{{ $json.a }}', right: '{{ $json.b }}' });
    expect(
      getConditionOperands({ ...legacy, value: undefined, values: ['1', '2'] }, fields).right
    ).toBe('["1","2"]');
    expect(getConditionOperands({ ...legacy, value: false }, fields).right).toBe('false');
  });
  it.each(['true', 'false', '["A"]', '{{ $json.a }}', '"文本"'])(
    '旧文本 %s 保留固定字符串语义',
    (value) => {
      expect(getConditionOperands({ ...legacy, value }, fields).right).toBe(JSON.stringify(value));
    }
  );
  it('新条件保留两边原文与精确数字，允许不依赖字段目录', () => {
    const source = createInputCondition(
      'leaf',
      '{{ $json.a }}',
      '100.000000000000000001',
      'NUM_GT'
    );
    expect(getConditionOperands(source, [])).toEqual({
      left: '{{ $json.a }}',
      right: '100.000000000000000001'
    });
    expect(validateConditionTree(source, [])).toEqual([]);
  });
  it.each(['{{ $json.values }}', '["10", "20"]', '["{{ $json.low }}", "20"]'])(
    '集合右值支持 %s',
    (right) => {
      expect(
        validateConditionTree(createInputCondition('leaf', '{{ $json.a }}', right, 'NUM_IN'), [])
      ).toEqual([]);
    }
  );

  it.each(['2026-11-04', '2026-11-04 08:00:00', '2026-11-04T08:00:00+08:00', '{{ $json.date }}'])(
    '日期比较接受 %s',
    (right) => {
      expect(
        validateConditionTree(createInputCondition('leaf', '{{ $json.date }}', right, 'GT'), [])
      ).toEqual([]);
    }
  );

  it.each(['100', 'true', '2026-02-30', '2026-11-04 24:00:00', '2026-02-30T00:00:00Z'])(
    '日期比较拒绝 %s，并定位到输入值',
    (right) => {
      expect(
        validateConditionTree(createInputCondition('leaf', '{{ $json.date }}', right, 'GT'), [])
      ).toEqual([
        expect.objectContaining({
          path: 'condition.rightValue',
          message: expect.stringContaining('日期比较')
        })
      ]);
    }
  );

  it('日期区间允许动态边界，数值大小比较不接受非数字常量', () => {
    expect(
      validateConditionTree(
        createInputCondition(
          'leaf',
          '{{ $json.date }}',
          '["2026-11-04", "{{ $json.end }}"]',
          'BETWEEN'
        ),
        []
      )
    ).toEqual([]);
    for (const right of ['', 'abc', 'true', '2026-11-04']) {
      expect(
        validateConditionTree(
          createInputCondition('leaf', '{{ $json.amount }}', right, 'NUM_GT'),
          []
        )
      ).toEqual([
        expect.objectContaining({
          path: 'condition.rightValue',
          message: expect.stringContaining('数字常量')
        })
      ]);
    }
  });
});
