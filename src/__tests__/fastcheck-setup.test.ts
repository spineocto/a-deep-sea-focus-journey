import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Fast-check Setup Verification', () => {
  it('should run property-based test', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a; // 加法交換律
      })
    );
  });
});
