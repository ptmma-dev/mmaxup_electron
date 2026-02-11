
import React, { useState, useRef, useEffect, useCallback } from 'react';
import FloatingMenu from './FloatingMenu';
import DownloadManager from './DownloadManager';
import CredentialsManager from './CredentialsManager';
import { APP_LOGO } from '../constants';
const appIcon = APP_LOGO;

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
  theme?: 'light' | 'dark';
}

const DEFAULT_URL = 'https://apps.mmaxup.com';

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
        background: `radial - gradient(circle at 20 % 20 %, oklch(0.6 0.2 25 / 0.2) 0 %, transparent 40 %),
    radial - gradient(circle at 80 % 80 %, oklch(0.5 0.2 250 / 0.2) 0 %, transparent 40 %),
    radial - gradient(circle at 50 % 50 %, oklch(1 0 0 / 0.05) 0 %, transparent 60 %)`,
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
          <img src={appIcon} alt="MyMMA Logo" style={{ width: '100%', height: '100%' }} />
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
                animation: `tapFinger 1.2s ease -in -out infinite`,
                animationDelay: `${i * 0.15} s`,
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
                animation: `tapRipple 1.2s ease -in -out infinite`,
                animationDelay: `${i * 0.15} s`,
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
    0 %, 100 % { transform: translateY(0); background- color: oklch(0.588 0.158 241.97 / 0.4);
}
20 % { transform: translateY(-15px); background- color: oklch(0.588 0.158 241.97 / 0.6); }
40 % { transform: translateY(2px); background- color: oklch(0.588 0.158 241.97 / 0.8); }
50 % { transform: translateY(0); }
                }
@keyframes tapRipple {
    0 %, 35 % { transform: translateX(-50 %) scale(0.5); opacity: 0; }
    40 % { transform: translateX(-50 %) scale(1); opacity: 0.8; }
    60 % { transform: translateX(-50 %) scale(2.5); opacity: 0; }
    100 % { opacity: 0; }
}
@keyframes logoPulseDock {
    0 %, 100 % { transform: scale(1); filter: drop - shadow(0 0 15px oklch(0.588 0.158 241.97 / 0.4)); }
    50 % { transform: scale(1.05); filter: drop - shadow(0 0 25px oklch(0.588 0.158 241.97 / 0.6)); }
}
@keyframes bgMove {
    0 % { transform: translate(0, 0) rotate(0deg); }
    100 % { transform: translate(15 %, 15 %) rotate(5deg); }
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
    icon: APP_LOGO
  }]);
  const [activeTabId, setActiveTabId] = useState('main');
  const [preloadPath, setPreloadPath] = useState<string>('');
  const [showDownloads, setShowDownloads] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const webviewRefs = useRef<{ [key: string]: any }>({});


  // Sync with system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    console.log('[Theme] Initial system theme dark match:', mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      console.log('[Theme] System theme change detected! matches dark:', e.matches);
      setTheme(e.matches ? 'dark' : 'light');
    };

    // Standard event listener
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
      {/* Save Password Prompt Removed as per user request (Auto-save via 'Remember Me') */}
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
        onToggleCredentials={() => setShowCredentials(!showCredentials)}
        theme={theme}
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

                    // Strategy A: Passive Monitoring & Navigation Trigger
                    // 1. Inject script to passively monitor inputs and cache them
                    const monitorScript = `
                                            (function() {
                                                if (window.__credMonitorInit) return;
                                                window.__credMonitorInit = true;
                                                window.__loginTemp = null;

                                                console.log('[CredMonitor] Initialized for:', window.location.hostname);
                                                
                                                function checkInputs() {
                                                    const passwordField = document.querySelector('input[type="password"]');
                                                    const usernameField = document.querySelector('input[type="text"], input[type="email"]');
                                                    const rememberCheckbox = document.querySelector('input[type="checkbox"][name="remember"], input[type="checkbox"][id*="remember"], input[type="checkbox"][id*="ingat"]');
                                                    
                                                    if (passwordField && usernameField && passwordField.value && usernameField.value) {
                                                        // Cache data globally so we can retrieve it on navigation
                                                        window.__loginTemp = {
                                                            username: usernameField.value,
                                                            password: passwordField.value,
                                                            remember: rememberCheckbox ? rememberCheckbox.checked : false,
                                                            domain: window.location.hostname
                                                        };
                                                        // console.log('[CredMonitor] Cached credentials possibly ready');
                                                    }
                                                }

                                                document.addEventListener('input', checkInputs, true);
                                                document.addEventListener('change', checkInputs, true);
                                                document.addEventListener('submit', () => {
                                                    checkInputs();
                                                    console.log('[CredMonitor] Form submitted, data cached');
                                                }, true);
                                            })();
                                        `;

                    // Inject monitor script when loading starts/stops to ensure it's there
                    el.addEventListener('did-finish-load', async () => {
                      try {
                        // 1. Inject Monitor Script
                        el.executeJavaScript(monitorScript);

                        // 2. Inject Autofill Script (if credentials exist)
                        // @ts-ignore
                        if (window.myMMA && window.myMMA.getCredentials) {
                          const url = el.getURL();
                          const hostname = new URL(url).hostname;
                          // @ts-ignore
                          const creds = await window.myMMA.getCredentials(hostname);

                          if (creds && creds.length > 0) {
                            const { username, password } = creds[0];
                            console.log(`[BrowserShell] Found credentials for ${hostname}, injecting autofill...`);

                            const autofillScript = `
                                                            (function() {
                                                                const username = "${username.replace(/"/g, '\\"')}";
                                                                const password = "${password.replace(/"/g, '\\"')}";
                                                                
                                                                function setNativeValue(element, value) {
                                                                    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
                                                                    const prototype = Object.getPrototypeOf(element);
                                                                    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
                                                                    
                                                                    if (valueSetter && valueSetter !== prototypeValueSetter) {
                                                                    	prototypeValueSetter.call(element, value);
                                                                    } else {
                                                                    	valueSetter.call(element, value);
                                                                    }
                                                                    
                                                                    element.dispatchEvent(new Event('input', { bubbles: true }));
                                                                    element.dispatchEvent(new Event('change', { bubbles: true }));
                                                                }

                                                                function autofill() {
                                                                    const passwordField = document.querySelector('input[type="password"]');
                                                                    if (!passwordField) return;
                                                                    
                                                                    const form = passwordField.form;
                                                                    let usernameField = null;
                                                                    
                                                                    if (form) {
                                                                        usernameField = form.querySelector('input[type="text"], input[type="email"], input:not([type])');
                                                                    }
                                                                    
                                                                    if (!usernameField) {
                                                                         usernameField = document.querySelector('input[type="text"], input[type="email"]');
                                                                    }
                                                                    
                                                                    if (usernameField && passwordField) {
                                                                        console.log('[AutofillScript] Filling credentials with native setter...');
                                                                        
                                                                        // Only fill if empty to respond to "odd" behavior report
                                                                        if (!usernameField.value) setNativeValue(usernameField, username);
                                                                        if (!passwordField.value) setNativeValue(passwordField, password);
                                                                    }
                                                                }
                                                                
                                                                // Run immediately
                                                                autofill();
                                                                // And retry on DOM changes (for dynamic forms)
                                                                const observer = new MutationObserver(autofill);
                                                                observer.observe(document.body, { childList: true, subtree: true });
                                                            })();
                                                        `;
                            el.executeJavaScript(autofillScript);
                          }
                        }

                      } catch (e) {
                        console.error('Failed to inject scripts', e);
                      }
                    });

                    // 2. Check for cached credentials on navigation
                    const checkAndSaveCredentials = async () => {
                      try {
                        // Execute script to get and clear the temp data atomically
                        const data = await el.executeJavaScript('(() => { const d = window.__loginTemp; window.__loginTemp = null; return d; })()');

                        if (data && data.username && data.password && data.remember) {
                          console.log('[BrowserShell] Auto-saving credentials via navigation trigger:', { ...data, password: '***' });

                          // @ts-ignore
                          if (window.myMMA && window.myMMA.saveCredentials) {
                            // @ts-ignore
                            window.myMMA.saveCredentials(
                              data.domain,
                              data.username,
                              data.password
                            );

                            // Show notification
                            // @ts-ignore
                            if (window.myMMA.showNotification) {
                              // @ts-ignore
                              window.myMMA.showNotification('Kredensial Disimpan', {
                                body: `Sandi untuk ${data.username} telah disimpan.`
                              });
                            }
                          }
                        } else if (data) {
                          console.log('[BrowserShell] Credentials found but Remember Me not checked. Skipping.');
                        }
                      } catch (err) {
                        // Context might be invalid or script not run, ignore
                      }
                    };

                    // Capture on standard navigation (before page unloads)
                    el.addEventListener('will-navigate', (e) => {
                      console.log('[BrowserShell] Will navigate to:', e.url);
                      checkAndSaveCredentials();
                    });

                    // Capture on in-page navigation (SPA)
                    el.addEventListener('did-navigate-in-page', (e) => {
                      console.log('[BrowserShell] SPA Navigation to:', e.url);
                      checkAndSaveCredentials();
                    });

                    // Handle IPC messages
                    el.addEventListener('ipc-message', (e) => {
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
      <CredentialsManager
        visible={showCredentials}
        onClose={() => setShowCredentials(false)}
        theme={theme}
      />
      <div style={{
        position: 'fixed',
        bottom: '8px',
        right: '8px',
        fontSize: '10px',
        color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        zIndex: 9999
      }}>
        v1.0.0
      </div>
    </div>
  );
};

export default BrowserShell;
