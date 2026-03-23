import api from './client'
import type { Proxy, CreateProxyRequest, UpdateProxyFormRequest } from '@/types'

export const proxyApi = {
  // GET /api/proxies
  list(): Promise<Proxy[]> {
    return api.get('/proxies').then((r) => r.data)
  },

  // GET /api/proxies/:id
  get(id: string): Promise<Proxy> {
    return api.get(`/proxies/${id}`).then((r) => r.data)
  },

  // POST /api/proxies
  create(data: CreateProxyRequest): Promise<Proxy> {
    return api.post('/proxies', data).then((r) => r.data)
  },

  // PUT /api/proxies/:id
  update(id: string, data: UpdateProxyFormRequest): Promise<Proxy> {
    return api.put(`/proxies/${id}`, data).then((r) => r.data)
  },

  // POST /api/proxies/:id/test
  test(id: string): Promise<{ success: boolean; proxy: Proxy }> {
    return api.post(`/proxies/${id}/test`).then((r) => r.data)
  },

  // DELETE /api/proxies/:id
  delete(id: string): Promise<void> {
    return api.delete(`/proxies/${id}`).then(() => undefined)
  },
}
