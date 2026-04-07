import React, { useState, KeyboardEvent, ClipboardEvent } from 'react'
import { X } from 'lucide-react'

interface RecipientInputProps {
  value: string // Comma separated emails
  onChange: (value: string) => void
  placeholder?: string
  isLight?: boolean
}

const RecipientInput: React.FC<RecipientInputProps> = ({ 
  value, 
  onChange, 
  placeholder = 'tambah email...', 
  isLight = false 
}) => {
  const [inputValue, setInputValue] = useState('')
  
  // Convert comma string to array, filter out empty strings
  const tags = value ? value.split(',').map(email => email.trim()).filter(Boolean) : []

  const addTag = (email: string) => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) return

    if (!tags.includes(trimmedEmail)) {
      const newTags = [...tags, trimmedEmail]
      onChange(newTags.join(','))
    }
    setInputValue('')
  }

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    onChange(newTags.join(','))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasteData = e.clipboardData.getData('text')
    const emails = pasteData.split(/[,\s\n]+/)
    
    let newTags = [...tags]
    let changed = false

    emails.forEach(email => {
      const trimmed = email.trim()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (trimmed && emailRegex.test(trimmed) && !newTags.includes(trimmed)) {
        newTags.push(trimmed)
        changed = true
      }
    })

    if (changed) {
      onChange(newTags.join(','))
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    minHeight: '28px'
  }

  const tagStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'inherit',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
    transition: 'all 0.2s'
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: '15px',
    outline: 'none',
    minWidth: '120px',
    padding: '2px 0'
  }

  return (
    <div style={containerStyle}>
      {tags.map((tag, index) => (
        <div key={index} style={tagStyle}>
          <span>{tag}</span>
          <button
            onClick={() => removeTag(index)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'flex',
              cursor: 'pointer',
              color: 'inherit',
              opacity: 0.5
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <input
        type="text"
        placeholder={tags.length === 0 ? placeholder : ''}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => addTag(inputValue)}
        style={inputStyle}
      />
    </div>
  )
}

export default RecipientInput
