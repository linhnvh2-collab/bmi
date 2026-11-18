import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';

export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';

export class GeminiConfigError extends Error {
  statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export class GeminiTimeoutError extends Error {
  statusCode = 504;
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

export function hasConfiguredGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiConfigError(
      'Chưa cấu hình GEMINI_API_KEY hợp lệ trên máy chủ. Vui lòng thiết lập khóa API Gemini trong Settings > Secrets để dùng tính năng AI.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  if (status === 429 || status === 503 || status === 502 || status === 500) {
    return true;
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('fetch failed') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('rate limit')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gọi Gemini API với kiểm soát timeout và retry có độ trễ tăng dần khi gặp lỗi tạm thời (429/503/network).
 */
export async function generateGeminiJsonContent(
  params: Omit<GenerateContentParameters, 'model'>,
  options?: { timeoutMs?: number; maxRetries?: number }
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 28_000;
  const maxRetries = options?.maxRetries ?? 1;
  const ai = getGeminiClient();

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const callPromise = ai.models.generateContent({
        ...params,
        model: GEMINI_MODEL,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(
            new GeminiTimeoutError(
              'Yêu cầu Gemini AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại hoặc giảm số ngày lập thực đơn.'
            )
          );
        }, timeoutMs);
        // Clean up timer if callPromise settles first
        void callPromise.finally(() => clearTimeout(timer));
      });

      const response = await Promise.race([callPromise, timeoutPromise]);
      const text = response.text;
      if (!text || !text.trim()) {
        throw new Error('Gemini không trả về nội dung JSON hợp lệ.');
      }
      return text;
    } catch (err) {
      lastError = err;
      if (
        err instanceof GeminiConfigError ||
        err instanceof GeminiTimeoutError ||
        attempt >= maxRetries ||
        !isRetryableError(err)
      ) {
        throw err;
      }
      await sleep(750 * (attempt + 1));
    }
  }

  throw lastError;
}

export function sanitizeAiErrorResponse(
  err: unknown,
  fallbackMessage: string
): { status: number; body: { error: string; detail?: string } } {
  if (err instanceof GeminiConfigError || err instanceof GeminiTimeoutError) {
    return { status: err.statusCode, body: { error: err.message } };
  }
  const statusCandidate =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : 500;
  const status =
    statusCandidate >= 400 && statusCandidate < 600 ? statusCandidate : 500;
  const rawMessage = err instanceof Error ? err.message : String(err);
  const safeDetail = rawMessage.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]');
  const isInvalidKey =
    safeDetail.includes('API_KEY_INVALID') ||
    safeDetail.includes('API key not valid');

  return {
    status: isInvalidKey ? 503 : status,
    body: {
      error: isInvalidKey
        ? 'Khóa GEMINI_API_KEY trên máy chủ chưa hợp lệ hoặc chưa được kích hoạt. Vui lòng kiểm tra trong Settings > Secrets.'
        : status === 429
          ? 'Hệ thống AI tạm thời chạm giới hạn lượt gọi. Vui lòng đợi ít giây rồi thử lại.'
          : fallbackMessage,
      detail: safeDetail.slice(0, 500),
    },
  };
}
