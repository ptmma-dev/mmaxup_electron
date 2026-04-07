import React, { useState, useEffect } from 'react'
import { X, MapPin, Save, Info } from 'lucide-react'

interface DesktopSettings {
    startOnBackground: boolean
    startOnTray: boolean
    fakeGps: boolean
    lat: number
    lng: number
}

interface DesktopSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    theme: 'light' | 'dark'
}

const DesktopSettingsModal: React.FC<DesktopSettingsModalProps> = ({ isOpen, onClose, theme }) => {
    const [settings, setSettings] = useState<DesktopSettings>({
        startOnBackground: false,
        startOnTray: true,
        fakeGps: false,
        lat: -6.1751,
        lng: 106.8650
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const isLight = theme === 'light'

    useEffect(() => {
        if (isOpen) {
            // @ts-ignore
            if (window.myMMA && window.myMMA.getDesktopSettings) {
                // @ts-ignore
                window.myMMA.getDesktopSettings().then((res: any) => {
                    setSettings(res)
                    setLoading(false)
                })
            }
        }
    }, [isOpen])

    const handleSave = async () => {
        setSaving(true)
        // @ts-ignore
        if (window.myMMA && window.myMMA.setDesktopSettings) {
            // @ts-ignore
            const res = await window.myMMA.setDesktopSettings(settings)
            if (res.success) {
                onClose()
            } else {
                alert('Gagal menyimpan pengaturan: ' + res.error)
            }
        }
        setSaving(false)
    }

    if (!isOpen) return null

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10001,
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: isLight ? 'white' : 'oklch(0.18 0 0)',
                    width: '450px',
                    borderRadius: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                    border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '90vh',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    color: isLight ? 'black' : 'white'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '20px 24px',
                        borderBottom: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Pengaturan Desktop</h2>
                        <p style={{ fontSize: '12px', opacity: 0.6, margin: '2px 0 0 0' }}>Kustomisasi pengalaman aplikasi Electron Anda</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            opacity: 0.5,
                            padding: '4px'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>Memuat pengaturan...</div>
                    ) : (
                        <>
                            {/* startup section */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '12px', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sistem & Startup</h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        padding: '12px 16px',
                                        backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                                        borderRadius: '12px',
                                        transition: 'background-color 0.2s'
                                    }} className="settings-item">
                                        <span style={{ fontSize: '14px', fontWeight: '500' }}>Jalankan otomatis saat OS dimulai</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.startOnBackground}
                                            onChange={e => setSettings({ ...settings, startOnBackground: e.target.checked })}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </label>

                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        padding: '12px 16px',
                                        backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                                        borderRadius: '12px',
                                        transition: 'background-color 0.2s'
                                    }} className="settings-item">
                                        <span style={{ fontSize: '14px', fontWeight: '500' }}>Mulai di System Tray (Sembunyi)</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.startOnTray}
                                            onChange={e => setSettings({ ...settings, startOnTray: e.target.checked })}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Geolocation Section */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{ fontSize: '12px', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Lokasi & GPS Spoofer</h3>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        color: '#3b82f6',
                                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                        padding: '4px 10px',
                                        borderRadius: '20px'
                                    }}>
                                        <Info size={12} /> LINUX ONLY
                                    </div>
                                </div>

                                <div
                                    style={{
                                        padding: '16px',
                                        backgroundColor: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: '14px',
                                        fontSize: '12.5px',
                                        lineHeight: '1.6',
                                        opacity: 0.9,
                                        color: isLight ? '#64748b' : '#94a3b8'
                                    }}
                                >
                                    Gunakan fitur ini jika deteksi lokasi WiFi Anda tidak akurat. Kami akan memalsukan koordinat GPS yang dikirimkan ke situs web di dalam aplikasi ini.
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    padding: '16px',
                                    backgroundColor: settings.fakeGps ? (isLight ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.08)') : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
                                    borderRadius: '16px',
                                    border: settings.fakeGps ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                backgroundColor: settings.fakeGps ? '#3b82f6' : (isLight ? '#e2e8f0' : '#334155'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                transition: 'all 0.3s'
                                            }}>
                                                <MapPin size={20} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '15px', fontWeight: '700' }}>Aktifkan Fake GPS</span>
                                                <span style={{ fontSize: '11px', opacity: 0.5 }}>Override koordinat sistem</span>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.fakeGps}
                                            onChange={e => setSettings({ ...settings, fakeGps: e.target.checked })}
                                            style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                                        />
                                    </label>

                                    {settings.fakeGps && (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                            marginTop: '8px',
                                            paddingTop: '16px',
                                            borderTop: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                                            animation: 'fadeIn 0.3s ease-out'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.7 }}>Latitude</span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="-6.1751"
                                                    value={settings.lat}
                                                    onChange={e => setSettings({ ...settings, lat: parseFloat(e.target.value) })}
                                                    style={{
                                                        padding: '12px',
                                                        borderRadius: '10px',
                                                        border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
                                                        backgroundColor: isLight ? 'white' : '#0f172a',
                                                        color: 'inherit',
                                                        fontSize: '14px',
                                                        fontWeight: '500',
                                                        outline: 'none',
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                    onFocus={e => (e.target as any).style.borderColor = '#3b82f6'}
                                                    onBlur={e => (e.target as any).style.borderColor = isLight ? '#cbd5e1' : '#334155'}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.7 }}>Longitude</span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="106.8650"
                                                    value={settings.lng}
                                                    onChange={e => setSettings({ ...settings, lng: parseFloat(e.target.value) })}
                                                    style={{
                                                        padding: '12px',
                                                        borderRadius: '10px',
                                                        border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
                                                        backgroundColor: isLight ? 'white' : '#0f172a',
                                                        color: 'inherit',
                                                        fontSize: '14px',
                                                        fontWeight: '500',
                                                        outline: 'none',
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                    onFocus={e => (e.target as any).style.borderColor = '#3b82f6'}
                                                    onBlur={e => (e.target as any).style.borderColor = isLight ? '#cbd5e1' : '#334155'}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 24px',
                        backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'none',
                            color: 'inherit',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            opacity: 0.6
                        }}
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {saving ? 'Menyimpan...' : <><Save size={16} /> Simpan</>}
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
        </div>
    )
}

export default DesktopSettingsModal
