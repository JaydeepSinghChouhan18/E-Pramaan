import { ApiResponse } from '@e-pramaan/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = localStorage.getItem('e_pramaan_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}/api/v1${endpoint}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        }
      });
    } catch (networkErr: any) {
      throw new Error(`Cannot connect to server at ${API_BASE_URL}. Ensure backend is running.`);
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Server returned HTTP ${response.status} (${response.statusText})`);
    }

    if (response.status === 401) {
      localStorage.removeItem('e_pramaan_token');
      localStorage.removeItem('e_pramaan_user');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (!response.ok || !data?.success) {
      let serverMessage = data?.error?.message || data?.message || `HTTP ${response.status}`;
      if (data?.error?.details?.fieldErrors) {
        const fieldErrors = Object.entries(data.error.details.fieldErrors)
          .map(([f, msgs]: [string, any]) => `${f}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('; ');
        if (fieldErrors) {
          serverMessage = `${serverMessage} (${fieldErrors})`;
        }
      }
      throw new Error(serverMessage);
    }

    return data as ApiResponse<T>;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  patch<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }
}

export const api = new ApiClient();
