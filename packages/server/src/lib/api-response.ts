import type { ApiResponse } from '@flowboard/shared';

export function success<T>(data: T, statusCode = 200): { body: ApiResponse<T>; statusCode: number } {
  return {
    statusCode,
    body: { success: true, data },
  };
}

export function error(
  code: string,
  message: string,
  statusCode = 500,
  details?: unknown,
): { body: ApiResponse<never>; statusCode: number } {
  return {
    statusCode,
    body: { success: false, error: { code, message, ...(details !== undefined && { details }) } },
  };
}
