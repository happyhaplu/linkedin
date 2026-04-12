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
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('Authentication required'))
    }
    // On 402 → no active plan → redirect to pricing
    if (error.response?.status === 402) {
      if (!window.location.pathname.startsWith('/pricing')) {
        window.location.href = '/pricing'
      }
      return Promise.reject(new Error('Active billing plan required'))
    }
    return Promise.reject(error)
  }
)

export default api
