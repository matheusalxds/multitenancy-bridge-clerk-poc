export function getApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3000';
}

export interface ApiError {
  error: { code: string; message: string };
}

export async function apiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ status: number; body: T | ApiError }> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return { status: response.status, body: (await response.json()) as T | ApiError };
}
