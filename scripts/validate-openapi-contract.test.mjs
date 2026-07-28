import { describe, expect, it } from 'vitest';
import {
  REQUIRED_OPERATIONS,
  validateOpenApiContract
} from './validate-openapi-contract.mjs';

function createContract() {
  return {
    openapi: '3.0.1',
    paths: Object.fromEntries(
      REQUIRED_OPERATIONS.map(({ method, operationId, path }) => [
        path,
        { [method]: { operationId } }
      ])
    )
  };
}

describe('validateOpenApiContract', () => {
  it('accepts a contract containing the required frontend operations', () => {
    expect(() => validateOpenApiContract(createContract())).not.toThrow();
  });

  it('rejects a structurally valid contract from an incompatible backend', () => {
    const contract = createContract();
    contract.paths['/api/iam/auth/login'].post.operationId = 'anotherLogin';

    expect(() => validateOpenApiContract(contract)).toThrowError(
      /POST \/api\/iam\/auth\/login（operationId: iamAuthLogin）/
    );
  });
});
