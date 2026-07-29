import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site-config';

export const runtime = 'edge';
export const alt = siteConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#080808',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          padding: '80px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(250,204,21,0.15), transparent 70%)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
          <div style={{ fontSize: 28, color: '#a1a1aa', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {siteConfig.name}
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: '#fafafa',
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            See every request your Mac makes.
          </div>
          <div style={{ fontSize: 28, color: '#a1a1aa', maxWidth: 800, lineHeight: 1.4 }}>
            Open-source network debugger for macOS. Inspect, mock, and replay HTTP/HTTPS traffic.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
