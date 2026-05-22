////////////////////////////////////////////////////////////////////////////////
// 🛑 Nothing in here has anything to do with Nextjs, it's just a fake database
////////////////////////////////////////////////////////////////////////////////

import { faker } from '@faker-js/faker';
import { matchSorter } from 'match-sorter'; // For filtering
import { PRODUCT_CATEGORIES } from './product-categories';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PRODUCT_NAME_PREFIXES = ['轻享', '智选', '匠心', '悦活', '高阶', '甄选', '质感', '灵感'];

const PRODUCT_NAME_BY_CATEGORY: Record<(typeof PRODUCT_CATEGORIES)[number], string[]> = {
  电子产品: ['蓝牙耳机', '智能手表', '便携音箱', '降噪耳机', '桌面音响', '平板支架'],
  家居家具: ['人体工学座椅', '原木边桌', '收纳置物架', '落地阅读灯', '软包床头柜', '简约书桌'],
  服饰鞋包: ['防风外套', '轻量双肩包', '休闲运动鞋', '针织开衫', '通勤托特包', '速干长裤'],
  玩具母婴: ['启蒙积木', '安抚玩偶', '儿童画板', '拼装轨道车', '益智卡片', '陪伴夜灯'],
  食品杂货: ['有机坚果礼盒', '冷萃咖啡液', '低糖燕麦脆', '花果茶组合', '即食谷物杯', '轻食能量棒'],
  图书文创: ['创意笔记本', '旅行手账套装', '插画明信片', '阅读摘录本', '桌面月历', '灵感便签盒'],
  珠宝配饰: ['珍珠项链', '极简耳钉', '锁骨链', '编织手链', '复古胸针', '925 银戒'],
  美妆个护: ['修护精华液', '氨基酸洁面', '焕亮面膜', '护手霜套装', '香氛身体乳', '防晒喷雾']
};

const PRODUCT_DESCRIPTION_HIGHLIGHTS = [
  '细节做工扎实',
  '兼顾颜值与实用性',
  '日常使用更省心',
  '适合长期稳定使用',
  '手感与质感表现出色',
  '适配多种使用场景'
];

const PRODUCT_DESCRIPTION_SCENES = ['通勤', '居家', '旅行', '办公', '送礼', '周末休闲'];

function generateProductName(category: (typeof PRODUCT_CATEGORIES)[number]) {
  const prefix = faker.helpers.arrayElement(PRODUCT_NAME_PREFIXES);
  const noun = faker.helpers.arrayElement(PRODUCT_NAME_BY_CATEGORY[category]);
  const model = faker.number.int({ min: 100, max: 999 });

  return `${prefix}${noun} ${model}`;
}

function generateProductDescription(name: string) {
  const scene = faker.helpers.arrayElement(PRODUCT_DESCRIPTION_SCENES);
  const highlight = faker.helpers.arrayElement(PRODUCT_DESCRIPTION_HIGHLIGHTS);

  return `${name}适用于${scene}场景，${highlight}，能够在保持舒适体验的同时提升整体使用效率。`;
}

// Define the shape of Product data
export type Product = {
  photo_url: string;
  name: string;
  description: string;
  created_at: string;
  price: number;
  id: number;
  category: string;
  updated_at: string;
};

// Mock product data store
export const fakeProducts = {
  records: [] as Product[], // Holds the list of product objects

  // Initialize with sample data
  initialize() {
    const sampleProducts: Product[] = [];
    function generateRandomProductData(id: number): Product {
      const category = faker.helpers.arrayElement(PRODUCT_CATEGORIES);
      const name = generateProductName(category);

      return {
        id,
        name,
        description: generateProductDescription(name),
        created_at: faker.date.between({ from: '2022-01-01', to: '2023-12-31' }).toISOString(),
        price: parseFloat(faker.commerce.price({ min: 5, max: 500, dec: 2 })),
        photo_url: `https://api.slingacademy.com/public/sample-products/${id}.png`,
        category,
        updated_at: faker.date.recent().toISOString()
      };
    }

    // Generate remaining records
    for (let i = 1; i <= 2000; i++) {
      sampleProducts.push(generateRandomProductData(i));
    }

    this.records = sampleProducts;
  },

  // Get all products with optional category filtering and search
  async getAll({ categories = [], search }: { categories?: string[]; search?: string }) {
    let products = [...this.records];

    // Filter products based on selected categories
    if (categories.length > 0) {
      products = products.filter((product) => categories.includes(product.category));
    }

    // Search functionality across multiple fields
    if (search) {
      products = matchSorter(products, search, {
        keys: ['name', 'description', 'category']
      });
    }

    return products;
  },

  // Get paginated results with optional category filtering, search, and sorting
  async getProducts({
    page = 1,
    limit = 10,
    categories,
    search,
    sort
  }: {
    page?: number;
    limit?: number;
    categories?: string | string[];
    search?: string;
    sort?: string;
  }) {
    await delay(1000);
    const categoriesArray = categories
      ? Array.isArray(categories)
        ? categories
        : String(categories).split(/[.,]/)
      : [];
    const allProducts = await this.getAll({
      categories: categoriesArray,
      search
    });

    // Sorting
    if (sort) {
      try {
        const sortItems = JSON.parse(sort) as {
          id: string;
          desc: boolean;
        }[];
        if (sortItems.length > 0) {
          const { id, desc } = sortItems[0];
          allProducts.sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[id];
            const bVal = (b as Record<string, unknown>)[id];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return desc ? bVal - aVal : aVal - bVal;
            }
            const aStr = String(aVal ?? '').toLowerCase();
            const bStr = String(bVal ?? '').toLowerCase();
            return desc ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
          });
        }
      } catch {
        // Invalid sort param — ignore
      }
    }

    const totalProducts = allProducts.length;

    // Pagination logic
    const offset = (page - 1) * limit;
    const paginatedProducts = allProducts.slice(offset, offset + limit);

    // Mock current time
    const currentTime = new Date().toISOString();

    // Return paginated response
    return {
      success: true,
      time: currentTime,
      message: '用于测试与演示的示例数据',
      total_products: totalProducts,
      offset,
      limit,
      products: paginatedProducts
    };
  },

  // Get a specific product by its ID
  async getProductById(id: number) {
    await delay(3000); // Simulate a slow API call

    // Find the product by its ID
    const product = this.records.find((product) => product.id === id);

    if (!product) {
      return {
        success: false,
        message: `未找到 ID 为 ${id} 的产品`
      };
    }

    // Mock current time
    const currentTime = new Date().toISOString();

    return {
      success: true,
      time: currentTime,
      message: `已找到 ID 为 ${id} 的产品`,
      product
    };
  },

  // Create a new product
  async createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'photo_url'>) {
    await delay(1000);

    const newProduct: Product = {
      ...data,
      id: this.records.length + 1,
      photo_url: `https://api.slingacademy.com/public/sample-products/${this.records.length + 1}.png`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.records.push(newProduct);

    return {
      success: true,
      message: '产品创建成功',
      product: newProduct
    };
  },

  // Update an existing product
  async updateProduct(
    id: number,
    data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'photo_url'>
  ) {
    await delay(1000);

    const index = this.records.findIndex((product) => product.id === id);

    if (index === -1) {
      return {
        success: false,
        message: `未找到 ID 为 ${id} 的产品`
      };
    }

    this.records[index] = {
      ...this.records[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    return {
      success: true,
      message: '产品更新成功',
      product: this.records[index]
    };
  },

  // Delete a product
  async deleteProduct(id: number) {
    await delay(1000);

    const index = this.records.findIndex((product) => product.id === id);

    if (index === -1) {
      return { success: false, message: `未找到 ID 为 ${id} 的产品` };
    }

    this.records.splice(index, 1);

    return {
      success: true,
      message: '产品删除成功'
    };
  }
};

// Initialize sample products
fakeProducts.initialize();
