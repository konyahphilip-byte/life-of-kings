const apiRoot = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${apiRoot}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });
  const value = await response.json();
  if (!response.ok) {
    throw new Error(value?.error?.message || 'The request could not be completed.');
  }
  return value as T;
}
