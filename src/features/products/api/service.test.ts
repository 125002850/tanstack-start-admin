import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeProducts } from '@/constants/mock-api';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from './service';

// Service functions delegate to fakeProducts, which uses setTimeout-based
// delays (1000 ms for list & mutations, 3000 ms for getById). We use fake
// timers to skip delays deterministically and reset the store before each test.

describe('Product Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the in-memory store to 2000 seeded products
    fakeProducts.initialize();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // getProducts
  // -----------------------------------------------------------------------
  describe('getProducts', () => {
    it('getProducts returns paginated results', async () => {
      const promise = getProducts({ page: 1, limit: 10 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(Array.isArray(result.products)).toBe(true);
      expect(result.products.length).toBeLessThanOrEqual(10);
      expect(typeof result.total_products).toBe('number');
      expect(result.total_products).toBeGreaterThan(0);
    });

    it('getProducts returns a second page with no overlap', async () => {
      const p1Promise = getProducts({ page: 1, limit: 10 });
      await vi.runAllTimersAsync();
      const page1 = await p1Promise;

      const p2Promise = getProducts({ page: 2, limit: 10 });
      await vi.runAllTimersAsync();
      const page2 = await p2Promise;

      const page1Ids = page1.products.map((p) => p.id);
      const page2Ids = page2.products.map((p) => p.id);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('getProducts supports text search', async () => {
      // Grab a known product name so the search is predictable
      const allPromise = getProducts({ page: 1, limit: 2000 });
      await vi.runAllTimersAsync();
      const allResult = await allPromise;
      const searchTerm = allResult.products[0].name.slice(0, 4);

      const searchPromise = getProducts({
        page: 1,
        limit: 100,
        search: searchTerm
      });
      await vi.runAllTimersAsync();
      const searchResult = await searchPromise;

      expect(searchResult.products.length).toBeGreaterThan(0);
      // Searching should narrow the result set
      expect(searchResult.total_products).toBeLessThan(allResult.total_products);
    });

    it('getProducts supports category filter', async () => {
      // PRODUCT_CATEGORIES uses Chinese labels (e.g. 电子产品, 家居家具)
      const promise = getProducts({
        page: 1,
        limit: 100,
        categories: '电子产品'
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.products.length).toBeGreaterThan(0);
      for (const product of result.products) {
        expect(product.category).toBe('电子产品');
      }
    });

    it('getProducts supports sorting by price ascending', async () => {
      const promise = getProducts({
        page: 1,
        limit: 100,
        sort: JSON.stringify([{ id: 'price', desc: false }])
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.products.length).toBeGreaterThan(1);
      const prices = result.products.map((p) => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('getProducts supports sorting by price descending', async () => {
      const promise = getProducts({
        page: 1,
        limit: 100,
        sort: JSON.stringify([{ id: 'price', desc: true }])
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.products.length).toBeGreaterThan(1);
      const prices = result.products.map((p) => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });
  });

  // -----------------------------------------------------------------------
  // getProductById
  // -----------------------------------------------------------------------
  describe('getProductById', () => {
    it('getProductById returns a single product', async () => {
      // Fetch a list first to obtain a valid ID
      const listPromise = getProducts({ page: 1, limit: 1 });
      await vi.runAllTimersAsync();
      const listResult = await listPromise;
      const existingId = listResult.products[0].id;

      const promise = getProductById(existingId);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.product).toBeDefined();
      expect(result.product.id).toBe(existingId);
    });

    it('getProductById returns error for non-existent id', async () => {
      const promise = getProductById(999999);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.message).toContain('999999');
    });
  });

  // -----------------------------------------------------------------------
  // createProduct
  // -----------------------------------------------------------------------
  describe('createProduct', () => {
    it('createProduct adds a new product', async () => {
      const newProduct = {
        name: 'Test Product',
        category: '电子产品',
        price: 99.99,
        description: 'A test product for unit testing'
      };

      const createPromise = createProduct(newProduct);
      await vi.runAllTimersAsync();
      const createResult = await createPromise;

      expect(createResult.success).toBe(true);
      expect(createResult.product.name).toBe('Test Product');
      expect(createResult.product.category).toBe('电子产品');
      expect(createResult.product.price).toBe(99.99);

      // Verify the product appears in the full listing
      const listPromise = getProducts({ page: 1, limit: 2100 });
      await vi.runAllTimersAsync();
      const listResult = await listPromise;

      const found = listResult.products.find((p) => p.name === 'Test Product');
      expect(found).toBeDefined();
      expect(found?.price).toBe(99.99);
    });
  });

  // -----------------------------------------------------------------------
  // updateProduct
  // -----------------------------------------------------------------------
  describe('updateProduct', () => {
    it('updateProduct modifies an existing product', async () => {
      // Create a product to update
      const createPromise = createProduct({
        name: 'Original Name',
        category: '家居家具',
        price: 50,
        description: 'Original description'
      });
      await vi.runAllTimersAsync();
      const createResult = await createPromise;
      const productId = createResult.product.id;

      // Update it
      const updatePromise = updateProduct(productId, {
        name: 'Updated Name',
        category: '家居家具',
        price: 75,
        description: 'Updated description'
      });
      await vi.runAllTimersAsync();
      const updateResult = await updatePromise;

      expect(updateResult.success).toBe(true);
      expect(updateResult.product).toBeDefined();
      if (!updateResult.product) {
        throw new Error('Expected updated product to be returned');
      }
      expect(updateResult.product.name).toBe('Updated Name');
      expect(updateResult.product.price).toBe(75);
      expect(updateResult.product.description).toBe('Updated description');

      // Cross-check via getProductById
      const getPromise = getProductById(productId);
      await vi.runAllTimersAsync();
      const getResult = await getPromise;

      expect(getResult.product.name).toBe('Updated Name');
    });
  });

  // -----------------------------------------------------------------------
  // deleteProduct
  // -----------------------------------------------------------------------
  describe('deleteProduct', () => {
    it('deleteProduct removes a product', async () => {
      // Create a product to delete
      const createPromise = createProduct({
        name: 'To Delete',
        category: '食品杂货',
        price: 10,
        description: 'Will be deleted'
      });
      await vi.runAllTimersAsync();
      const createResult = await createPromise;
      const productId = createResult.product.id;

      // Delete it
      const deletePromise = deleteProduct(productId);
      await vi.runAllTimersAsync();
      const deleteResult = await deletePromise;

      expect(deleteResult.success).toBe(true);

      // Verify it no longer exists
      const getPromise = getProductById(productId);
      await vi.runAllTimersAsync();
      const getResult = await getPromise;

      expect(getResult.success).toBe(false);
    });
  });
});
