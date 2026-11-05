import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createRateLimiter,
  __resetRateLimitBuckets,
} from "../src/middleware/rateLimit.js";

const mockRes = () => {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: null,
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
};

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimitBuckets());

  it("allows requests under the max", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, keyPrefix: "t" });
    let nextCount = 0;
    const next = () => {
      nextCount += 1;
    };
    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      limiter({ ip: "1.1.1.1" }, res, next);
    }
    assert.equal(nextCount, 3);
  });

  it("blocks when exceeding max", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: "t2" });
    const next = () => {};
    limiter({ ip: "2.2.2.2" }, mockRes(), next);
    limiter({ ip: "2.2.2.2" }, mockRes(), next);
    const res = mockRes();
    limiter({ ip: "2.2.2.2" }, res, next);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.success, false);
  });
});
