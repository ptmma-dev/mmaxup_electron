import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Link } from '@tiptap/extension-link'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  List, ListOrdered, AlignLeft, AlignCenter, 
  AlignRight, Link as LinkIcon, Highlighter,
  Minus, Image as ImageIcon
} from 'lucide-react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  isLight: boolean
}

const MenuBar = ({ editor, isLight }: { editor: any; isLight: boolean }) => {
  if (!editor) return null

  const btnStyle = (active = false) => ({
    padding: '4px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: active 
      ? (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)') 
      : 'transparent',
    color: active ? 'oklch(0.588 0.158 241.97)' : 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    width: '28px',
    height: '28px'
  })

  const setLink = () => {
    const url = window.prompt('Masukkan URL')
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const addImage = () => {
    const url = window.prompt('Masukkan URL Gambar (Logo)')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '2px',
      padding: '6px',
      borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
      backgroundColor: isLight ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.01)',
      borderRadius: '10px 10px 0 0'
    }}>
      <button onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))} title="Bold">
        <Bold size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))} title="Italic">
        <Italic size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} style={btnStyle(editor.isActive('underline'))} title="Underline">
        <UnderlineIcon size={16} />
      </button>
      <div style={{ width: '1px', backgroundColor: 'rgba(128,128,128,0.15)', margin: '4px 4px' }} />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))} title="Bulleted List">
        <List size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))} title="Ordered List">
        <ListOrdered size={16} />
      </button>
      <div style={{ width: '1px', backgroundColor: 'rgba(128,128,128,0.15)', margin: '4px 4px' }} />
      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} style={btnStyle(editor.isActive({ textAlign: 'left' }))} title="Align Left">
        <AlignLeft size={16} />
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} style={btnStyle(editor.isActive({ textAlign: 'center' }))} title="Align Center">
        <AlignCenter size={16} />
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} style={btnStyle(editor.isActive({ textAlign: 'right' }))} title="Align Right">
        <AlignRight size={16} />
      </button>
      <div style={{ width: '1px', backgroundColor: 'rgba(128,128,128,0.15)', margin: '4px 4px' }} />
      <button onClick={setLink} style={btnStyle(editor.isActive('link'))} title="Add Link">
        <LinkIcon size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHighlight().run()} style={btnStyle(editor.isActive('highlight'))} title="Highlight">
        <Highlighter size={16} />
      </button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} style={btnStyle()} title="Horizontal Line">
        <Minus size={16} />
      </button>
      <button onClick={addImage} style={btnStyle()} title="Insert Image">
        <ImageIcon size={16} />
      </button>
    </div>
  )
}

const RichTextEditor = ({ content, onChange, isLight }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        style: `
          min-height: 150px;
          padding: 12px;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
        `,
      },
    },
  })

  // Update editor if content prop changes (e.g. from props)
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div style={{
      border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: '10px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: isLight ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.01)',
      minHeight: '200px'
    }}>
      <MenuBar editor={editor} isLight={isLight} />
      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror ul { padding-left: 20px; list-style-type: disc; }
        .ProseMirror ol { padding-left: 20px; list-style-type: decimal; }
        .ProseMirror h1 { font-size: 2em; font-weight: bold; }
        .ProseMirror h2 { font-size: 1.5em; font-weight: bold; }
        .ProseMirror a { color: #3b82f6; text-decoration: underline; cursor: pointer; }
      `}</style>
    </div>
  )
}

export default RichTextEditor
