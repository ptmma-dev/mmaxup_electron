import React from 'react'
import { APP_LOGO } from '../constants'

interface LoadingOverlayProps {
    visible: boolean
    message?: string
    style?: React.CSSProperties
}

const appIcon = APP_LOGO

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message = 'Memuat Halaman', style }) => {
    return (
        <div
            style={{
                ...style,
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
                zIndex: 10005,
                opacity: visible ? 1 : 0,
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: visible ? 'all' : 'none',
                backdropFilter: 'blur(25px)',
                overflow: 'hidden'
            }}
        >
            {/* Animated Background Gradients (Red, White, Blue Theme) */}
            <div
                style={{
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
                }}
            />

            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '40px',
                    transform: visible ? 'scale(1)' : 'scale(0.95)',
                    transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
            >
                {/* MyMMA Logo with Pulse */}
                <div
                    style={{
                        width: '60px',
                        height: '60px',
                        animation: 'logoPulseDock 2s ease-in-out infinite',
                        filter: 'drop-shadow(0 0 15px oklch(0.588 0.158 241.97 / 0.4))'
                    }}
                >
                    <img src={appIcon} alt="MyMMA Logo" style={{ width: '100%', height: '100%' }} />
                </div>

                {/* Finger Tapping Animation (Blue Theme) */}
                <div
                    style={{
                        display: 'flex',
                        gap: '12px',
                        height: '40px',
                        alignItems: 'flex-end',
                        padding: '0 20px'
                    }}
                >
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} style={{ position: 'relative' }}>
                            <div
                                style={{
                                    width: '10px',
                                    height: '30px',
                                    backgroundColor: 'oklch(0.588 0.158 241.97 / 0.5)', // MyMMA Blue
                                    borderRadius: '5px',
                                    animation: `tapFinger 1.2s ease-in-out infinite`,
                                    animationDelay: `${i * 0.15}s`,
                                    boxShadow: '0 0 10px oklch(0.588 0.158 241.97 / 0.2)'
                                }}
                            />
                            <div
                                style={{
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
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div
                style={{
                    marginTop: '40px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    opacity: 0.5,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3em'
                }}
            >
                <span>{message}</span>
                <span style={{ display: 'inline-flex', gap: '0.2em' }}>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            style={{
                                animation: `dotFade 1.4s ease-in-out infinite`,
                                animationDelay: `${i * 0.2}s`,
                                opacity: 0
                            }}
                        >
                            .
                        </span>
                    ))}
                </span>
            </div>

            <style
                dangerouslySetInnerHTML={{
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
@keyframes dotFade {
    0%, 20% { opacity: 0; }
    40% { opacity: 1; }
    60% { opacity: 1; }
    80%, 100% { opacity: 0; }
}
`
                }}
            />
        </div>
    )
}

export default LoadingOverlay
