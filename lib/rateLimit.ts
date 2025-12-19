import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (voor productie: gebruik Redis of Vercel KV)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup oude entries elke 10 minuten
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minuut
  maxRequests: 60, // 60 requests per minuut
};

export function rateLimit(config: RateLimitConfig = defaultConfig) {
  return (request: NextRequest): NextResponse | null => {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();
    
    const key = `${ip}`;
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Nieuwe window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return null; // Allow request
    }

    if (entry.count >= config.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      
      return NextResponse.json(
        { 
          error: 'Te veel requests. Probeer het later opnieuw.',
          retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetAt.toString(),
          }
        }
      );
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);

    return null; // Allow request
  };
}

// Verschillende rate limit configs voor verschillende endpoints
export const downloadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuut
  maxRequests: 10, // 10 downloads per minuut
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuut  
  maxRequests: 60, // 60 API calls per minuut
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 uur
  maxRequests: 5, // 5 uploads per uur (voor anonymous users)
});
