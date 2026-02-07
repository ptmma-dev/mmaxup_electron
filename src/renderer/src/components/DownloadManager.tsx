import React, { useState, useEffect } from 'react';

interface DownloadItem {
    id: string;
    fileName: string;
    date: string;
    receivedBytes: number;
    totalBytes: number;
    status: 'downloading' | 'completed' | 'failed';
    filePath?: string;
    reason?: string;
}

interface DownloadManagerProps {
    show?: boolean;
    onClose?: () => void;
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ show, onClose }) => {
    const [downloads, setDownloads] = useState<{ [key: string]: DownloadItem }>({});
    const [internalShow, setInternalShow] = useState(false);

    // Visibility logic: controlled by parent 'show' or internally when download starts
    const isVisible = show !== undefined ? show : internalShow;
    const handleClose = onClose || (() => setInternalShow(false));

    useEffect(() => {
        // @ts-ignore
        if (window.myMMA) {
            // @ts-ignore
            window.myMMA.onDownloadStarted((data: any) => {
                setDownloads(prev => ({
                    ...prev,
                    [data.id]: {
                        ...data,
                        receivedBytes: 0,
                        status: 'downloading'
                    }
                }));
                setInternalShow(true);
            });

            // @ts-ignore
            window.myMMA.onDownloadProgress((data: any) => {
                setDownloads(prev => {
                    if (prev[data.id]) {
                        return {
                            ...prev,
                            [data.id]: {
                                ...prev[data.id],
                                receivedBytes: data.receivedBytes,
                                totalBytes: data.totalBytes
                            }
                        };
                    }
                    return prev;
                });
            });

            // @ts-ignore
            window.myMMA.onDownloadCompleted((data: any) => {
                setDownloads(prev => {
                    if (prev[data.id]) {
                        return {
                            ...prev,
                            [data.id]: {
                                ...prev[data.id],
                                status: 'completed',
                                filePath: data.filePath
                            }
                        };
                    }
                    return prev;
                });
            });

            // @ts-ignore
            window.myMMA.onDownloadFailed((data: any) => {
                setDownloads(prev => {
                    if (prev[data.id]) {
                        return {
                            ...prev,
                            [data.id]: {
                                ...prev[data.id],
                                status: 'failed',
                                reason: data.reason
                            }
                        };
                    }
                    return prev;
                });
            });
        }
    }, []);

    const downloadList = Object.values(downloads).sort((a, b) => b.id.localeCompare(a.id));

    // Only return null if not visible AND no active downloads to show the toggle handle
    if (!isVisible && downloadList.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '25px',
            zIndex: 1000,
            width: '320px',
            maxHeight: '400px',
            backgroundColor: 'oklch(0.18 0 0 / 0.95)',
            backdropFilter: 'blur(30px)',
            borderRadius: '20px',
            border: '1px solid oklch(1 0 0 / 0.1)',
            boxShadow: '0 20px 50px oklch(0 0 0 / 0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: isVisible ? 'translateY(0)' : 'translateY(calc(100% + 40px))',
            visibility: isVisible || downloadList.some(d => d.status === 'downloading') ? 'visible' : 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid oklch(1 0 0 / 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(to right, oklch(0.588 0.158 241.97 / 0.1), transparent)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: downloadList.some(d => d.status === 'downloading') ? 'oklch(0.7 0.2 150)' : 'oklch(1 0 0 / 0.3)', animation: downloadList.some(d => d.status === 'downloading') ? 'pulse 1.5s infinite' : 'none' }} />
                    <span style={{ color: 'white', fontWeight: '800', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Unduhan</span>
                </div>
                <button
                    onClick={handleClose}
                    style={{
                        background: 'oklch(1 0 0 / 0.05)',
                        border: 'none',
                        color: 'oklch(1 0 0 / 0.6)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '8px',
                        display: 'flex',
                        transition: 'all 0.2s'
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {downloadList.length === 0 ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px 20px',
                        opacity: 0.3,
                        color: 'white',
                        textAlign: 'center'
                    }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '12px' }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        <div style={{ fontSize: '12px', fontWeight: '700' }}>Tidak ada unduhan</div>
                    </div>
                ) : downloadList.map(item => (
                    <div key={item.id} style={{
                        padding: '14px',
                        borderRadius: '16px',
                        backgroundColor: 'oklch(1 0 0 / 0.04)',
                        border: '1px solid oklch(1 0 0 / 0.05)',
                        transition: 'all 0.3s ease'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start' }}>
                            <div style={{
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '180px',
                                letterSpacing: '0.01em'
                            }}>
                                {item.fileName}
                            </div>
                            <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'oklch(1 0 0 / 0.3)', textTransform: 'uppercase' }}>
                                {item.date.split(',')[0]}
                            </div>
                        </div>

                        {item.status === 'downloading' && (
                            <div style={{ width: '100%' }}>
                                <div style={{
                                    height: '6px',
                                    backgroundColor: 'oklch(1 0 0 / 0.08)',
                                    borderRadius: '3px',
                                    overflow: 'hidden',
                                    marginBottom: '8px'
                                }}>
                                    <div style={{
                                        width: `${(item.receivedBytes / item.totalBytes) * 100}%`,
                                        height: '100%',
                                        background: 'linear-gradient(to right, oklch(0.588 0.158 241.97), oklch(0.7 0.2 241.97))',
                                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: '0 0 10px oklch(0.588 0.158 241.97 / 0.4)'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'oklch(1 0 0 / 0.4)' }}>
                                        {Math.round((item.receivedBytes / 1024 / 1024) * 10) / 10} / {item.totalBytes ? Math.round((item.totalBytes / 1024 / 1024) * 10) / 10 : '?'} MB
                                    </div>
                                    <div style={{ fontSize: '10px', fontWeight: '900', color: 'oklch(0.588 0.158 241.97)' }}>
                                        {item.totalBytes ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0}%
                                    </div>
                                </div>
                            </div>
                        )}

                        {item.status === 'completed' && (
                            <div style={{ color: 'oklch(0.75 0.15 150)', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'oklch(0.75 0.15 150 / 0.15)', display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" style={{ margin: 'auto' }}>
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                </div>
                                Selesai
                            </div>
                        )}

                        {item.status === 'failed' && (
                            <div style={{ color: 'oklch(0.65 0.18 30)', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'oklch(0.65 0.18 30 / 0.15)', display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" style={{ margin: 'auto' }}>
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </div>
                                Gagal: {item.reason}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Toggle Handle (appears only when panel is hidden but downloads exist) */}
            {!isVisible && (
                <div
                    onClick={() => setInternalShow(true)}
                    style={{
                        position: 'absolute',
                        top: '-50px',
                        right: '0',
                        height: '42px',
                        padding: '0 20px',
                        backgroundColor: 'oklch(0.18 0 0 / 0.9)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid oklch(1 0 0 / 0.1)',
                        borderBottom: 'none',
                        borderRadius: '16px 16px 0 0',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 -10px 30px oklch(0 0 0 / 0.3)',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        {Object.values(downloads).filter(d => d.status === 'downloading').length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: 'oklch(0.588 0.158 241.97)',
                                fontSize: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 8px oklch(0.588 0.158 241.97 / 0.5)'
                            }}>
                                {Object.values(downloads).filter(d => d.status === 'downloading').length}
                            </div>
                        )}
                    </div>
                    <span>UNDUHAN</span>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.5); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.5; }
                }
            ` }} />
        </div>
    );
};

export default DownloadManager;
