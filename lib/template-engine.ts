/**
 * Template Engine for Campaign Messages
 * Handles variable replacement and spintax processing
 */

interface Lead {
  first_name?: string
  last_name?: string
  full_name?: string
  company?: string
  position?: string
  headline?: string
  location?: string
  email?: string
  linkedin_url?: string
  [key: string]: any
}

interface TemplateVariables {
  [key: string]: string | undefined
}

/**
 * Replace template variables with lead data
 * Supports: {{firstName}}, {{lastName}}, {{company}}, {{position}}, etc.
 */
export function replaceVariables(template: string, lead: Lead): string {
  if (!template) return ''
  
  // Build variable map
  const variables: TemplateVariables = {
    firstName: lead.first_name || lead.full_name?.split(' ')[0] || '',
    lastName: lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || '',
    fullName: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    company: lead.company || '',
    position: lead.position || lead.headline || '',
    headline: lead.headline || lead.position || '',
    location: lead.location || '',
    email: lead.email || '',
    linkedinUrl: lead.linkedin_url || '',
    aiIcebreaker: lead.ai_icebreaker || ''
  }
  
  // Replace all variables
  let result = template
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'gi')
    result = result.replace(regex, value || '')
  })
  
  // Clean up any remaining unreplaced variables (replace with empty string)
  result = result.replace(/{{[^}]+}}/g, '')
  
  return result.trim()
}

/**
 * Process spintax: {Option1|Option2|Option3}
 * Randomly selects one option from pipe-separated list
 */
export function processSpintax(text: string): string {
  if (!text) return ''
  
  const spintaxRegex = /{([^}]+)}/g
  
  let result = text
  let match: RegExpExecArray | null
  
  // Find all spintax patterns
  while ((match = spintaxRegex.exec(text)) !== null) {
    const fullMatch = match[0] // {Option1|Option2|Option3}
    const options = match[1].split('|').map(opt => opt.trim()) // ['Option1', 'Option2', 'Option3']
    
    // Randomly select one option
    const selectedOption = options[Math.floor(Math.random() * options.length)]
    
    // Replace the spintax with selected option
    result = result.replace(fullMatch, selectedOption)
  }
  
  return result
}

/**
 * Validate template syntax
 * Returns array of errors if invalid
 */
export function validateTemplate(template: string): string[] {
  const errors: string[] = []
  
  if (!template || template.trim().length === 0) {
    errors.push('Template cannot be empty')
    return errors
  }
  
  // Check for unclosed variable braces
  const openBraces = (template.match(/{{/g) || []).length
  const closeBraces = (template.match(/}}/g) || []).length
  
  if (openBraces !== closeBraces) {
    errors.push('Unclosed variable braces detected ({{ or }})')
  }
  
  // Check for unclosed spintax braces
  const openSpintax = (template.match(/{(?!{)/g) || []).length
  const closeSpintax = (template.match(/}(?!})/g) || []).length
  
  if (openSpintax !== closeSpintax) {
    errors.push('Unclosed spintax braces detected ({ or })')
  }
  
  // Check for nested braces (not supported)
  if (/{{[^}]*{{/.test(template) || /{[^}]*{[^{]/.test(template)) {
    errors.push('Nested braces are not supported')
  }
  
  // Warn about unknown variables
  const knownVariables = [
    'firstName', 'lastName', 'fullName', 'company', 'position',
    'headline', 'location', 'email', 'linkedinUrl', 'aiIcebreaker'
  ]
  
  const variablePattern = /{{([^}]+)}}/g
  let match: RegExpExecArray | null
  
  while ((match = variablePattern.exec(template)) !== null) {
    const varName = match[1].trim()
    if (!knownVariables.includes(varName)) {
      errors.push(`Unknown variable: {{${varName}}}. Available: ${knownVariables.join(', ')}`)
    }
  }
  
  return errors
}

/**
 * Get list of variables used in template
 */
export function extractVariables(template: string): string[] {
  const variables: string[] = []
  const variablePattern = /{{([^}]+)}}/g
  let match: RegExpExecArray | null
  
  while ((match = variablePattern.exec(template)) !== null) {
    const varName = match[1].trim()
    if (!variables.includes(varName)) {
      variables.push(varName)
    }
  }
  
  return variables
}

/**
 * Check if lead has all required data for template
 */
export function hasRequiredData(template: string, lead: Lead): { 
  valid: boolean
  missing: string[] 
} {
  const variables = extractVariables(template)
  const missing: string[] = []
  
  const leadData: TemplateVariables = {
    firstName: lead.first_name || lead.full_name?.split(' ')[0],
    lastName: lead.last_name || lead.full_name?.split(' ').slice(1).join(' '),
    fullName: lead.full_name,
    company: lead.company,
    position: lead.position || lead.headline,
    headline: lead.headline || lead.position,
    location: lead.location,
    email: lead.email,
    linkedinUrl: lead.linkedin_url,
    aiIcebreaker: lead.ai_icebreaker
  }
  
  variables.forEach(varName => {
    if (!leadData[varName] || leadData[varName]?.trim().length === 0) {
      missing.push(varName)
    }
  })
  
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Generate preview of template with lead data
 */
export function previewTemplate(template: string, lead: Lead): {
  preview: string
  warnings: string[]
} {
  const warnings: string[] = []
  
  // Validate template first
  const errors = validateTemplate(template)
  if (errors.length > 0) {
    return {
      preview: template,
      warnings: errors
    }
  }
  
  // Check for missing data
  const { missing } = hasRequiredData(template, lead)
  if (missing.length > 0) {
    warnings.push(`Missing data for: ${missing.join(', ')}. These will be replaced with empty strings.`)
  }
  
  // Process template
  let preview = replaceVariables(template, lead)
  preview = processSpintax(preview)
  
  return {
    preview,
    warnings
  }
}

/**
 * Process complete message (variables + spintax)
 */
export function processTemplate(template: string, lead: Lead): string {
  // First replace variables
  let processed = replaceVariables(template, lead)
  
  // Then process spintax
  processed = processSpintax(processed)
  
  return processed
}

/**
 * Check character limits for different message types
 */
export function checkCharacterLimit(
  text: string, 
  type: 'connection_note' | 'message' | 'inmail'
): { 
  valid: boolean
  length: number
  limit: number
  overflow: number
} {
  const limits = {
    connection_note: 300,
    message: 8000,
    inmail: 1900 // InMail body limit
  }
  
  const limit = limits[type]
  const length = text.length
  
  return {
    valid: length <= limit,
    length,
    limit,
    overflow: Math.max(0, length - limit)
  }
}

/**
 * Example usage and testing
 */
export function testTemplateEngine() {
  const testLead: Lead = {
    first_name: 'John',
    last_name: 'Doe',
    full_name: 'John Doe',
    company: 'Acme Corp',
    position: 'VP of Sales',
    location: 'San Francisco, CA'
  }
  
  const templates = [
    "Hi {{firstName}}, I noticed you work at {{company}}. {Let's connect!|Would love to connect!}",
    "Hey {{fullName}}, saw your profile. {{position}} at {{company}} is impressive!",
    "{{firstName}}, {your background|your experience} in {{industry}} caught my attention",
    "Hi {{firstName}}, {{invalidVar}} test" // Should show warning
  ]
  
  console.log('=== Template Engine Test ===\n')
  
  templates.forEach((template, index) => {
    console.log(`Template ${index + 1}: ${template}`)
    
    const validation = validateTemplate(template)
    if (validation.length > 0) {
      console.log('  Validation Errors:', validation)
    }
    
    const { preview, warnings } = previewTemplate(template, testLead)
    console.log('  Preview:', preview)
    
    if (warnings.length > 0) {
      console.log('  Warnings:', warnings)
    }
    
    console.log('')
  })
}
