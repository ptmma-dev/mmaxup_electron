
import React, { useState, useRef, useEffect, useCallback } from 'react';
import FloatingMenu from './FloatingMenu';
import DownloadManager from './DownloadManager';

interface WebviewTag extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> {
    src: string;
    allowpopups?: string;
    preload?: string;
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'webview': WebviewTag;
        }
    }
}

interface Tab {
    id: string;
    url: string;
    title: string;
    icon?: string;
    loading?: boolean;
}

const DEFAULT_URL = 'https://apps.reytechz.my.id';

const LoadingOverlay: React.FC<{ visible: boolean; message?: string }> = ({ visible, message = 'Memuat Halaman...' }) => {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'oklch(0.145 0 0 / 0.85)',
            zIndex: 100,
            opacity: visible ? 1 : 0,
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: visible ? 'all' : 'none',
            backdropFilter: 'blur(25px)',
            overflow: 'hidden'
        }}>
            {/* Animated Background Gradients (Red, White, Blue Theme) */}
            <div style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: `radial-gradient(circle at 20% 20%, oklch(0.6 0.2 25 / 0.2) 0%, transparent 40%),
                           radial-gradient(circle at 80% 80%, oklch(0.5 0.2 250 / 0.2) 0%, transparent 40%),
                           radial-gradient(circle at 50% 50%, oklch(1 0 0 / 0.05) 0%, transparent 60%)`,
                animation: 'bgMove 20s linear infinite alternate',
                zIndex: -1
            }} />

            <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '40px',
                transform: visible ? 'scale(1)' : 'scale(0.95)',
                transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                {/* MyMMA Logo with Pulse */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    animation: 'logoPulseDock 2s ease-in-out infinite',
                    filter: 'drop-shadow(0 0 15px oklch(0.588 0.158 241.97 / 0.4))'
                }}>
                    <svg viewBox="0 0 35.92 25.99" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="0 .16 9.43 9.61 6.39 12.65 4.28 10.54 4.29 25.99 0 21.97 0 .16" style={{ fill: '#1dacdd' }} />
                        <polygon points="19.39 .16 6.5 13.07 12.57 13.07 19.32 6.33 24.48 11.49 10.17 25.99 18.13 23.86 30.79 11.63 19.39 .16" style={{ fill: '#1dacdd' }} />
                        <polygon points="19.39 .16 6.5 13.07 12.57 13.07 19.32 6.33 19.39 .16" style={{ fill: '#056d9b' }} />
                        <polygon points="35.85 0 35.92 6.17 30.76 11.33 35.89 16.53 35.89 22.44 24.45 11.47 35.85 0" style={{ fill: '#056d9b' }} />
                        <polygon points="19.39 16.64 10.17 25.99 18.13 23.86 19.39 22.64 19.39 16.64" style={{ fill: '#056d9b' }} />
                        <polygon points="20.54 21.53 19.39 22.64 19.39 16.64 20.54 15.48 20.54 21.53" style={{ fill: '#178baa' }} />
                        <polygon points="19.32 6.33 20.54 7.55 20.54 1.31 19.37 .16 19.32 6.33" style={{ fill: '#178baa' }} />
                    </svg>
                </div>

                {/* Finger Tapping Animation (Blue Theme) */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    height: '40px',
                    alignItems: 'flex-end',
                    padding: '0 20px'
                }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} style={{ position: 'relative' }}>
                            <div style={{
                                width: '10px',
                                height: '30px',
                                backgroundColor: 'oklch(0.588 0.158 241.97 / 0.5)', // MyMMA Blue
                                borderRadius: '5px',
                                animation: `tapFinger 1.2s ease-in-out infinite`,
                                animationDelay: `${i * 0.15}s`,
                                boxShadow: '0 0 10px oklch(0.588 0.158 241.97 / 0.2)'
                            }} />
                            <div style={{
                                position: 'absolute',
                                bottom: '-5px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '20px',
                                height: '2px',
                                backgroundColor: 'oklch(0.588 0.158 241.97 / 0.6)',
                                borderRadius: '50%',
                                filter: 'blur(3px)',
                                animation: `tapRipple 1.2s ease-in-out infinite`,
                                animationDelay: `${i * 0.15}s`,
                                opacity: 0
                            }} />
                        </div>
                    ))}
                </div>
            </div>

            <div style={{
                marginTop: '40px',
                color: 'white',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                opacity: 0.5,
                textAlign: 'center'
            }}>
                {message}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes tapFinger {
                    0%, 100% { transform: translateY(0); background-color: oklch(0.588 0.158 241.97 / 0.4); }
                    20% { transform: translateY(-15px); background-color: oklch(0.588 0.158 241.97 / 0.6); }
                    40% { transform: translateY(2px); background-color: oklch(0.588 0.158 241.97 / 0.8); }
                    50% { transform: translateY(0); }
                }
                @keyframes tapRipple {
                    0%, 35% { transform: translateX(-50%) scale(0.5); opacity: 0; }
                    40% { transform: translateX(-50%) scale(1); opacity: 0.8; }
                    60% { transform: translateX(-50%) scale(2.5); opacity: 0; }
                    100% { opacity: 0; }
                }
                @keyframes logoPulseDock {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px oklch(0.588 0.158 241.97 / 0.4)); }
                    50% { transform: scale(1.05); filter: drop-shadow(0 0 25px oklch(0.588 0.158 241.97 / 0.6)); }
                }
                @keyframes bgMove {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    100% { transform: translate(15%, 15%) rotate(5deg); }
                }
            ` }} />
        </div>
    );
};

const BrowserShell: React.FC = () => {
    const [tabs, setTabs] = useState<Tab[]>([{
        id: 'main',
        url: DEFAULT_URL,
        title: 'MyMMA',
        loading: true,
        icon: 'https://apps.reytechz.my.id/favicon.svg'
    }]);
    const [activeTabId, setActiveTabId] = useState('main');
    const [preloadPath, setPreloadPath] = useState<string>('');
    const [showDownloads, setShowDownloads] = useState(false);
    const webviewRefs = useRef<{ [key: string]: any }>({});

    const handleOpenTab = useCallback((id: string, name: string, url: string, icon?: string) => {
        setTabs(prev => {
            const existingTab = prev.find(t => t.id === id || t.url === url);
            if (existingTab) {
                return prev;
            }

            // Construct high-quality icon URL if missing and it's a MyMMA sub-app
            let finalIcon = icon;
            const isSubApp = /https?:\/\/[^\/]+\.(reytechz\.my\.id|mmaxup\.com)/.test(url);

            if (!finalIcon && isSubApp) {
                try {
                    const urlObj = new URL(url);
                    finalIcon = `${urlObj.protocol}//${urlObj.hostname}/favicon.svg`;
                } catch (e) {
                    // Fallback to null if URL parsing fails
                }
            }

            return [...prev, { id, title: name, icon: finalIcon, url, loading: true }];
        });
        setActiveTabId(id);
    }, []);

    useEffect(() => {
        // Fetch preload path from main process
        const fetchPreload = async () => {
            // @ts-ignore
            if (window.electron && window.electron.ipcRenderer) {
                const path = await window.electron.ipcRenderer.invoke('get-preload-path');
                setPreloadPath(path);
            }
        };
        fetchPreload();

        // Listen for tab opening requests from main process
        // @ts-ignore
        if (window.electron && window.electron.ipcRenderer) {
            const removeOpenListener = window.electron.ipcRenderer.on('open-app-tab-from-main', (_event, { id, name, url }) => {
                handleOpenTab(id, name, url);
            });

            const removeFocusListener = window.electron.ipcRenderer.on('focus-tab', (_event, { tabId }) => {
                setActiveTabId(tabId);
                // Also focus the window if it's not focused
                window.focus();
            });

            return () => {
                removeOpenListener();
                removeFocusListener();
            };
        }
        return () => { };
    }, [handleOpenTab]);

    const handleNewWindow = (e: any) => {
        e.preventDefault();
        const url = e.url;

        // Robust check for sub-app URLs (e.g. *.reytechz.my.id or *.mmaxup.com)
        const isSubApp = /https?:\/\/[^\/]+\.(reytechz\.my\.id|mmaxup\.com)/.test(url);

        if (isSubApp) {
            try {
                const urlObj = new URL(url);
                const hostParts = urlObj.hostname.split('.');
                const id = hostParts[0]; // Usually the subdomain
                const name = id.charAt(0).toUpperCase() + id.slice(1);
                handleOpenTab(id, name, url);
            } catch (err) {
                // Fallback if URL parsing fails
                handleOpenTab('app-' + Date.now(), 'Sub App', url);
            }
        } else {
            // For external links, open in the active tab context or block
            const activeWebview = webviewRefs.current[activeTabId];
            if (activeWebview) {
                activeWebview.loadURL(url);
            }
        }
    };

    const handleTitleUpdate = (id: string, e: any) => {
        const title = e.title;
        const parts = title.split('-');
        const parsedTitle = parts.length > 1 ? parts[parts.length - 1].trim() : title;

        setTabs(prev => prev.map(t => t.id === id ? { ...t, title: parsedTitle } : t));
    };

    const handleFaviconUpdate = (id: string, e: any) => {
        const favicons = e.favicons;
        if (favicons && favicons.length > 0) {
            setTabs(prev => prev.map(t => {
                if (t.id === id) {
                    // Don't override if we already have a high-quality SVG icon assigned
                    if (t.icon && t.icon.endsWith('.svg')) {
                        return t;
                    }
                    return { ...t, icon: favicons[0] };
                }
                return t;
            }));
        }
    };

    const activeWebview = webviewRefs.current[activeTabId];

    const goBack = () => {
        if (activeWebview && activeWebview.canGoBack()) {
            activeWebview.goBack();
        }
    };

    const goHome = () => {
        if (activeWebview) {
            activeWebview.loadURL(DEFAULT_URL);
            setActiveTabId('main');
        }
    };

    const goForward = () => {
        if (activeWebview && activeWebview.canGoForward()) {
            activeWebview.goForward();
        }
    };

    const refresh = () => {
        if (activeWebview) {
            activeWebview.reload();
        }
    };

    const handleSwitchTab = (tabId: string) => {
        setActiveTabId(tabId);
    };

    const handleCloseTab = (tabId: string) => {
        setTabs(prev => prev.filter(t => t.id !== tabId));
        delete webviewRefs.current[tabId];
        if (activeTabId === tabId) {
            setActiveTabId('main');
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'oklch(0.145 0 0)' }}>
            {/* Top Navigation Bar */}
            <FloatingMenu
                tabs={tabs}
                activeTabId={activeTabId}
                onSwitchTab={handleSwitchTab}
                onCloseTab={handleCloseTab}
                onBack={goBack}
                onForward={goForward}
                onHome={goHome}
                onRefresh={refresh}
                onToggleDownloads={() => setShowDownloads(!showDownloads)}
            />

            {/* Content Area */}
            <div style={{ flex: 1, position: 'relative' }}>
                <LoadingOverlay visible={!preloadPath} message="Menyiapkan Sistem MyMMA..." />

                {preloadPath && tabs.map(tab => (
                    <div
                        key={tab.id}
                        style={{
                            display: activeTabId === tab.id ? 'block' : 'none',
                            width: '100%',
                            height: '100%'
                        }}
                    >
                        <LoadingOverlay visible={!!tab.loading} />

                        <webview
                            ref={(el: any) => {
                                if (el) {
                                    webviewRefs.current[tab.id] = el;

                                    if (!el.dataset.ready) {
                                        el.addEventListener('new-window', handleNewWindow);
                                        el.addEventListener('page-title-updated', (e: any) => handleTitleUpdate(tab.id, e));
                                        el.addEventListener('page-favicon-updated', (e: any) => handleFaviconUpdate(tab.id, e));

                                        el.addEventListener('did-start-loading', () => {
                                            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, loading: true } : t));
                                        });

                                        el.addEventListener('did-stop-loading', () => {
                                            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, loading: false } : t));
                                        });

                                        el.addEventListener('ipc-message', (e: any) => {
                                            console.log(`[BrowserShell] IPC Message received from tab ${tab.id}: ${e.channel}`, e.args);
                                            if (e.channel === 'open-app-tab') {
                                                const { id, name, icon, url } = e.args[0];
                                                handleOpenTab(id, name, url, icon);
                                            } else if (e.channel === 'show-notification') {
                                                const { title, options } = e.args[0];
                                                console.log(`[BrowserShell] Notification requested: ${title}`, options);

                                                // Resolve relative icons to absolute URLs
                                                let finalIcon = options?.icon;
                                                const webview = webviewRefs.current[tab.id];
                                                const currentUrl = webview ? webview.getURL() : tab.url;

                                                if (finalIcon && !finalIcon.startsWith('http') && !finalIcon.startsWith('data:')) {
                                                    try {
                                                        finalIcon = new URL(finalIcon, currentUrl).href;
                                                    } catch (err) {
                                                        finalIcon = tab.icon;
                                                    }
                                                } else if (!finalIcon) {
                                                    finalIcon = tab.icon;
                                                }

                                                // Forward to main process with tab context
                                                // @ts-ignore
                                                if (window.electron && window.electron.ipcRenderer) {
                                                    window.electron.ipcRenderer.send('trigger-native-notification', {
                                                        title,
                                                        options: {
                                                            ...options,
                                                            icon: finalIcon,
                                                            data: { ...options?.data, tabId: tab.id }
                                                        }
                                                    });
                                                }
                                            }
                                        });

                                        el.dataset.ready = 'true';
                                    }
                                }
                            }}
                            src={tab.url}
                            preload={preloadPath}
                            style={{ width: '100%', height: '100%' }}
                            // @ts-ignore
                            allowpopups="true"
                            // @ts-ignore
                            webpreferences="contextIsolation=no, sandbox=no"
                        />
                    </div>
                ))}
            </div>
            <DownloadManager
                show={showDownloads}
                onClose={() => setShowDownloads(false)}
            />
        </div>
    );
};

export default BrowserShell;
