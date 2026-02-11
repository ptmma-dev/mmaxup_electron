
import React from 'react';
import { ChevronLeft, ChevronRight, Home, RotateCw, X, Minus, Square, Download, KeyRound } from 'lucide-react';

declare global {
  interface Window {
    windowControls: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    }
  }
}

// Extend CSSProperties to include Electron-specific properties
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
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

interface FloatingMenuProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onBack: () => void;
  onForward: () => void;
  onHome: () => void;
  onRefresh: () => void;
  onToggleDownloads: () => void;
  onToggleCredentials: () => void;
  theme?: 'light' | 'dark';
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onBack,
  onForward,
  onHome,
  onRefresh,
  onToggleDownloads,
  onToggleCredentials,
  theme = 'dark'
}) => {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const activeDownloads = React.useRef(new Set<string>());

  React.useEffect(() => {
    // @ts-ignore
    if (window.myMMA) {
      // @ts-ignore
      const removeStart = window.myMMA.onDownloadStarted((data: any) => {
        activeDownloads.current.add(data.id);
        setIsDownloading(activeDownloads.current.size > 0);
      });

      // @ts-ignore
      const removeComplete = window.myMMA.onDownloadCompleted((data: any) => {
        activeDownloads.current.delete(data.id);
        setIsDownloading(activeDownloads.current.size > 0);
      });

      // @ts-ignore
      const removeFail = window.myMMA.onDownloadFailed((data: any) => {
        activeDownloads.current.delete(data.id);
        setIsDownloading(activeDownloads.current.size > 0);
      });

      return () => {
        // Cleanup if the bridge supports it, otherwise these might leak if component unmounts
        // (Though FloatingMenu likely persists for the app lifetime)
      };
    }
    return () => { };
  }, []);

  const handleMinimize = () => window.windowControls?.minimize();
  const handleMaximize = () => window.windowControls?.maximize();
  const handleClose = () => window.windowControls?.close();

  const isLight = theme === 'light';

  return (
    <div style={{
      width: '100%',
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'oklch(0.205 0 0)',
      padding: '4px 12px',
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      zIndex: 9999,
      borderBottom: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
      color: isLight ? 'rgba(0,0,0,0.8)' : 'white',
      backdropFilter: 'blur(12px)',
      boxSizing: 'border-box',
      WebkitAppRegion: 'drag'
    }}>
      <style dangerouslySetInnerHTML={{
        __html: globalStyle(theme) + `
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
            ` }} />

      {/* Left: Navigation Controls */}
      <div style={{
        display: 'flex',
        gap: '2px',
        borderRight: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
        paddingRight: '12px',
        WebkitAppRegion: 'no-drag'
      }}>
        <button onClick={onBack} title="Back" style={btnStyle(theme)} className="nav-btn">
          <ChevronLeft size={18} />
        </button>
        <button onClick={onForward} title="Forward" style={btnStyle(theme)} className="nav-btn">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Center: Dynamic Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        overflowX: 'auto',
        padding: '4px 0',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        alignItems: 'center',
        flex: 1,
        WebkitAppRegion: 'no-drag'
      }}>
        {tabs.map(tab => {
          const isActive = activeTabId === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => onSwitchTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: isActive ? (isLight ? 'rgba(0,0,0,0.05)' : 'oklch(0.3 0 0)') : 'transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isActive ? (isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.15)') : '1px solid transparent',
                minWidth: isActive ? '120px' : '40px',
                maxWidth: '180px',
                position: 'relative',
                flexShrink: 0
              }}
            >
              {tab.icon ? (
                <img src={tab.icon} style={{ width: '16px', height: '16px', borderRadius: '3px' }} alt="" />
              ) : (
                <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px' }} />
              )}

              {(isActive || tabs.length < 5) && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: isActive ? '700' : '400',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  opacity: isActive ? 1 : 0.7
                }}>
                  {tab.title}
                </span>
              )}

              {isActive && tab.id !== 'main' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLight ? 'black' : 'white',
                    padding: '1px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.5,
                    marginLeft: '4px'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Right: Home, Refresh & Window Controls */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        WebkitAppRegion: 'no-drag'
      }}>
        <div style={{ display: 'flex', gap: '2px', borderLeft: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
          <button onClick={onToggleDownloads} title="Downloads" style={btnStyle(theme)} className="nav-btn">
            <Download size={18} style={{ animation: isDownloading ? 'bounce 1s infinite' : 'none' }} />
          </button>
          <button onClick={onToggleCredentials} title="Passwords" style={btnStyle(theme)} className="nav-btn">
            <KeyRound size={18} />
          </button>
          <button onClick={onHome} title="Home" style={btnStyle(theme)} className="nav-btn">
            <Home size={18} />
          </button>
          <button onClick={onRefresh} title="Refresh" style={btnStyle(theme)} className="nav-btn">
            <RotateCw size={18} />
          </button>
        </div>

        {/* Vertical Separator */}
        <div style={{ width: '1px', height: '20px', backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Window Control Buttons */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button onClick={handleMinimize} title="Minimize" style={windowBtnStyle(theme)} className="nav-btn">
            <Minus size={14} />
          </button>
          <button onClick={handleMaximize} title="Maximize" style={windowBtnStyle(theme)} className="nav-btn">
            <Square size={12} />
          </button>
          <button onClick={handleClose} title="Close" style={closeBtnStyle(theme)} className="close-btn">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const btnStyle = (theme: 'light' | 'dark'): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  color: theme === 'light' ? 'black' : 'white',
  cursor: 'pointer',
  padding: '6px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s',
  opacity: 0.8
});

const windowBtnStyle = (theme: 'light' | 'dark'): React.CSSProperties => ({
  ...btnStyle(theme),
  padding: '8px',
  borderRadius: '4px',
  opacity: 0.6
});

const closeBtnStyle = (theme: 'light' | 'dark'): React.CSSProperties => ({
  ...windowBtnStyle(theme)
});

// CSS for handle hover specifically for close button
const globalStyle = (theme: 'light' | 'dark') => `
    .nav-btn:hover { opacity: 1; background-color: ${theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}; }
    .close-btn:hover { background-color: #e81123 !important; opacity: 1 !important; color: white !important; }
`;

export default FloatingMenu;
