'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugImportPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  
  const addLog = (msg: string) => {
    console.log(msg)
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setLogs([])
    addLog('📁 File selected: ' + selectedFile.name)
    
    try {
      // Parse CSV
      const text = await selectedFile.text()
      addLog('📄 File read, length: ' + text.length)
      
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }
      
      const rows = text.split('\n').filter(row => row.trim())
      addLog(`📋 Total rows: ${rows.length}`)
      
      const headers = parseCSVLine(rows[0]).map(h => h.trim().toLowerCase())
      addLog(`🏷️ Headers (${headers.length}): ${headers.join(', ')}`)
      
      const data = rows.slice(1).map((row, rowIndex) => {
        const values = parseCSVLine(row)
        const obj: any = {}
        
        headers.forEach((header, index) => {
          const value = values[index]?.trim()
          if (!value) return
          
          if (header === 'profile url') obj.linkedin_url = value
          else if (header === 'first name') obj.first_name = value
          else if (header === 'last name') obj.last_name = value
          else if (header === 'full name') obj.full_name = value
          else if (header === 'headline') obj.headline = value
          else if (header === 'enriched email') obj.enriched_email = value
          else if (header === 'custom address') {
            obj.custom_address = value
            if (value.includes('@') && !obj.email && !obj.enriched_email) {
              obj.enriched_email = value
            }
          }
          else if (header === 'job title') obj.position = value
          else if (header === 'location') obj.location = value
          else if (header === 'company') obj.company = value
          else if (header === 'company url') obj.company_url = value
          else if (header === 'tags') obj.tags = value
        })
        
        if (rowIndex === 0) {
          addLog(`📝 First lead parsed: ${JSON.stringify(obj, null, 2)}`)
        }
        
        return obj
      }).filter(obj => Object.keys(obj).length > 0)
      
      addLog(`✅ Parsed ${data.length} leads successfully`)
      
      // Try to get lists
      addLog('🔍 Fetching lists...')
      const supabase = createClient()
      const { data: lists, error: listsError } = await supabase
        .from('lists')
        .select('*')
      
      if (listsError) {
        addLog(`❌ Error fetching lists: ${listsError.message}`)
      } else {
        addLog(`📋 Found ${lists?.length || 0} lists`)
        if (lists && lists.length > 0) {
          lists.forEach(list => {
            addLog(`  - ${list.name} (${list.lead_count} leads)`)
          })
        } else {
          addLog('⚠️ No lists found. Create a list first!')
        }
      }
      
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`)
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">CSV Import Debugger</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <label className="block text-sm font-medium mb-2">Upload CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-96">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet. Upload a CSV file to begin.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
