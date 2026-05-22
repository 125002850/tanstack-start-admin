export const PRODUCT_CATEGORIES = [
  '电子产品',
  '家居家具',
  '服饰鞋包',
  '玩具母婴',
  '食品杂货',
  '图书文创',
  '珠宝配饰',
  '美妆个护'
] as const;

export const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map((category) => ({
  value: category,
  label: category
}));
