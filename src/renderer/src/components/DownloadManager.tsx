import React, { useState, useEffect } from 'react'
import {
  File,
  FileImage,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  Film,
  Music,
  FolderOpen,
  Download as DownloadIcon,
  X,
  AlertCircle,
  Check,
  Trash2
} from 'lucide-react'

interface DownloadItem {
  id: string
  fileName: string
  date: string
  receivedBytes: number
  totalBytes: number
  status: 'downloading' | 'completed' | 'failed'
  filePath?: string
  reason?: string
}

interface DownloadManagerProps {
  visible?: boolean
  onClose?: () => void
  theme?: 'light' | 'dark'
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
      return <FileImage size={24} color="#a78bfa" /> // Purple for images
    case 'pdf':
      return <FileText size={24} color="#f87171" /> // Red for PDF
    case 'doc':
    case 'docx':
    case 'txt':
    case 'rtf':
      return <FileText size={24} color="#60a5fa" /> // Blue for docs
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet size={24} color="#34d399" /> // Green for sheets
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return <FileArchive size={24} color="#fbbf24" /> // Yellow for archives
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'json':
    case 'html':
    case 'css':
    case 'php':
      return <FileCode size={24} color="#f472b6" /> // Pink for code
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
      return <Film size={24} color="#fb923c" /> // Orange for video
    case 'mp3':
    case 'wav':
    case 'ogg':
      return <Music size={24} color="#22d3ee" /> // Cyan for audio
    default:
      return <File size={24} color="#9ca3af" /> // Gray for others
  }
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ visible, onClose, theme = 'dark' }) => {
  const [downloads, setDownloads] = useState<{ [key: string]: DownloadItem }>({})
  const [internalShow, setInternalShow] = useState(false)
  const [deletingItem, setDeletingItem] = useState<DownloadItem | null>(null)
  const isLight = theme === 'light'

  // Visibility logic: controlled by parent 'visible' or internally when download starts
  const isVisible = visible !== undefined ? visible : internalShow
  const handleClose = onClose || (() => setInternalShow(false))

  const loadHistory = async () => {
    // @ts-ignore
    if (window.myMMA && window.myMMA.getDownloadHistory) {
      // @ts-ignore
      const history = await window.myMMA.getDownloadHistory()
      if (history && history.length > 0) {
        const historyMap = history.reduce((acc: any, item: DownloadItem) => {
          acc[item.id] = { ...item, status: 'completed' }
          return acc
        }, {})
        setDownloads(historyMap)
      }
    }
  }

  useEffect(() => {
    loadHistory()
    // @ts-ignore
    if (window.myMMA) {
      // @ts-ignore
      window.myMMA.onDownloadStarted((data: any) => {
        setDownloads((prev) => ({
          ...prev,
          [data.id]: {
            ...data,
            receivedBytes: 0,
            status: 'downloading'
          }
        }))
        setInternalShow(true)
      })

      // @ts-ignore
      window.myMMA.onDownloadProgress((data: any) => {
        setDownloads((prev) => {
          if (prev[data.id]) {
            return {
              ...prev,
              [data.id]: {
                ...prev[data.id],
                receivedBytes: data.receivedBytes,
                totalBytes: data.totalBytes
              }
            }
          }
          return prev
        })
      })

      // @ts-ignore
      window.myMMA.onDownloadCompleted((data: any) => {
        setDownloads((prev) => {
          if (prev[data.id]) {
            return {
              ...prev,
              [data.id]: {
                ...prev[data.id],
                status: 'completed',
                filePath: data.filePath
              }
            }
          }
          return prev
        })
      })

      // @ts-ignore
      window.myMMA.onDownloadFailed((data: any) => {
        setDownloads((prev) => {
          if (prev[data.id]) {
            return {
              ...prev,
              [data.id]: {
                ...prev[data.id],
                status: 'failed',
                reason: data.reason
              }
            }
          }
          return prev
        })
      })
    }
  }, [])

  const downloadList = Object.values(downloads).sort((a: DownloadItem, b: DownloadItem) =>
    b.id.localeCompare(a.id)
  )

  // Only return null if not visible AND no active downloads to show the toggle handle
  if (!isVisible && downloadList.length === 0) return null

  const removeHistoryItem = async (id: string, deleteFile: boolean = false) => {
    console.log(`[DownloadManager] Removing history item: id=${id}, deleteFile=${deleteFile}`)
    // @ts-ignore
    if (window.myMMA && window.myMMA.removeDownloadHistory) {
      // @ts-ignore
      const result = await window.myMMA.removeDownloadHistory(id, deleteFile)
      console.log(`[DownloadManager] Removal result:`, result)
      setDownloads((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setDeletingItem(null)
    }
  }

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'oklch(0.18 0 0 / 0.95)',
        backdropFilter: 'blur(30px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.5s ease'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isLight
            ? 'linear-gradient(to right, rgba(0,0,0,0.02), transparent)'
            : 'linear-gradient(to right, oklch(0.588 0.158 241.97 / 0.1), transparent)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: downloadList.some((d) => d.status === 'downloading')
                ? 'oklch(0.7 0.2 150)'
                : 'oklch(1 0 0 / 0.3)',
              animation: downloadList.some((d) => d.status === 'downloading')
                ? 'pulse 1.5s infinite'
                : 'none'
            }}
          />
          <span
            style={{
              color: isLight ? 'black' : 'white',
              fontWeight: '800',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}
          >
            Unduhan
          </span>
        </div>
        <button
          onClick={handleClose}
          style={{
            background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
            border: 'none',
            color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            transition: 'all 0.2s'
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {downloadList.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              opacity: 0.4,
              color: isLight ? 'black' : 'white',
              textAlign: 'center'
            }}
          >
            <DownloadIcon size={40} style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '12px', fontWeight: '700' }}>Tidak ada unduhan</div>
          </div>
        ) : (
          downloadList.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.status === 'completed' && item.filePath) {
                  // @ts-ignore
                  if (window.myMMA && window.myMMA.openFile) {
                    // @ts-ignore
                    window.myMMA.openFile(item.filePath)
                  }
                }
              }}
              style={{
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)',
                border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.3s ease',
                cursor: item.status === 'completed' ? 'pointer' : 'default',
                position: 'relative', // For hover effect
                display: 'flex',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                if (item.status === 'completed') {
                  e.currentTarget.style.backgroundColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)'
              }}
            >
              {/* File Icon */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {getFileIcon(item.fileName)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                    alignItems: 'flex-start'
                  }}
                >
                  <div
                    style={{
                      color: isLight ? 'black' : 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '180px',
                      letterSpacing: '0.01em'
                    }}
                  >
                    {item.fileName}
                  </div>
                  <div
                    style={{
                      fontSize: '9px',
                      fontWeight: 'bold',
                      color: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
                      textTransform: 'uppercase'
                    }}
                  >
                    {item.date.split(',')[0]}
                  </div>
                </div>

                {item.status === 'downloading' && (
                  <div style={{ width: '100%' }}>
                    <div
                      style={{
                        height: '4px',
                        backgroundColor: 'oklch(1 0 0 / 0.08)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '6px'
                      }}
                    >
                      <div
                        style={{
                          width: `${(item.receivedBytes / item.totalBytes) * 100}%`,
                          height: '100%',
                          background:
                            'linear-gradient(to right, oklch(0.588 0.158 241.97), oklch(0.7 0.2 241.97))',
                          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 0 10px oklch(0.588 0.158 241.97 / 0.4)'
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div
                        style={{ fontSize: '10px', fontWeight: '700', color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}
                      >
                        {Math.round((item.receivedBytes / 1024 / 1024) * 10) / 10} /{' '}
                        {item.totalBytes
                          ? Math.round((item.totalBytes / 1024 / 1024) * 10) / 10
                          : '?'}{' '}
                        MB
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: '900',
                          color: 'oklch(0.588 0.158 241.97)'
                        }}
                      >
                        {item.totalBytes
                          ? Math.round((item.receivedBytes / item.totalBytes) * 100)
                          : 0}
                        %
                      </div>
                    </div>
                  </div>
                )}

                {item.status === 'completed' && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div
                      style={{
                        color: 'oklch(0.75 0.15 150)',
                        fontSize: '11px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Check size={12} strokeWidth={4} />
                      Selesai
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // @ts-ignore
                          if (window.myMMA && window.myMMA.showInFolder && item.filePath) {
                            // @ts-ignore
                            window.myMMA.showInFolder(item.filePath)
                          }
                        }}
                        title="Tampilkan di Folder"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = isLight ? 'black' : 'white')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)')}
                      >
                        <FolderOpen size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingItem(item)
                        }}
                        title="Hapus Unduhan"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'oklch(0.65 0.18 30)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {item.status === 'failed' && (
                  <div
                    style={{
                      color: 'oklch(0.65 0.18 30)',
                      fontSize: '11px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <AlertCircle size={12} strokeWidth={3} />
                    Gagal: {item.reason}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Deletion Confirmation Modal */}
      {deletingItem && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(10px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setDeletingItem(null)}
        >
          <div
            style={{
              backgroundColor: isLight ? 'white' : 'oklch(0.25 0 0)',
              borderRadius: '24px',
              padding: '24px',
              width: '100%',
              maxWidth: '320px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  backgroundColor: 'oklch(0.65 0.18 30 / 0.1)',
                  color: 'oklch(0.65 0.18 30)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}
              >
                <Trash2 size={24} />
              </div>
              <h3
                style={{
                  color: isLight ? 'black' : 'white',
                  fontSize: '16px',
                  fontWeight: '800',
                  margin: '0 0 8px 0'
                }}
              >
                Hapus Unduhan?
              </h3>
              <p
                style={{
                  color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  margin: 0
                }}
              >
                Pilih apakah Anda ingin menghapus riwayat saja atau berserta filenya.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={() => removeHistoryItem(deletingItem.id, false)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                  color: isLight ? 'black' : 'white',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)')}
              >
                Hapus Riwayat Saja
              </button>
              <button
                onClick={() => removeHistoryItem(deletingItem.id, true)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'oklch(0.65 0.18 30)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px oklch(0.65 0.18 30 / 0.3)'
                }}
              >
                Hapus File & Riwayat
              </button>
              <button
                onClick={() => setDeletingItem(null)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'none',
                  color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.5); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.5; }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
            `
        }}
      />
    </div >
  )
}

export default DownloadManager
