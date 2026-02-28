import { SocksProxyAgent } from 'socks-proxy-agent'
import { ProxyType } from '@/types/linkedin'

export interface ProxyTestResult {
  success: boolean
  latency?: number
  error?: string
}

export async function testProxyConnection(
  type: ProxyType,
  host: string,
  port: number,
  username?: string,
  password?: string
): Promise<ProxyTestResult> {
  try {
    const startTime = Date.now()
    
    // Build proxy URL
    let proxyUrl = `${type}://`
    if (username && password) {
      proxyUrl += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    }
    proxyUrl += `${host}:${port}`

    // Test connection with a simple HTTP request
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      let response: Response
      
      if (type.startsWith('socks')) {
        // For SOCKS proxies, use socks-proxy-agent
        const agent = new SocksProxyAgent(proxyUrl)
        response = await fetch('https://api.ipify.org?format=json', {
          // @ts-ignore
          agent,
          signal: controller.signal
        })
      } else {
        // For HTTP/HTTPS proxies
        response = await fetch('https://api.ipify.org?format=json', {
          signal: controller.signal,
          headers: {
            'Proxy-Authorization': username && password 
              ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
              : ''
          }
        })
      }

      clearTimeout(timeout)

      if (response.ok) {
        const latency = Date.now() - startTime
        return {
          success: true,
          latency
        }
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (fetchError: any) {
      clearTimeout(timeout)
      throw fetchError
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Connection failed'
    }
  }
}

export function validateProxyConfig(
  host: string,
  port: number
): { valid: boolean; error?: string } {
  // Validate host (IP or domain)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i
  
  if (!ipRegex.test(host) && !domainRegex.test(host)) {
    return { valid: false, error: 'Invalid host format' }
  }

  // Validate port
  if (port < 1 || port > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' }
  }

  return { valid: true }
}
