import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // On 401 → session expired or not authenticated → redirect to login
    if (error.response?.status === 401) {
      // Avoid redirect loop if already on login page
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('Authentication required'))
    }

    const message = error.response?.data?.error || error.message || 'An error occurred'
    return Promise.reject(new Error(message))
  }
)

export default api
