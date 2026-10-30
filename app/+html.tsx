import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const iconFontStyles = `
@font-face {
  font-family: 'Ionicons';
  src: url('/fonts/Ionicons.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'FontAwesome5Free-Regular';
  src: url('/fonts/FontAwesome5_Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'FontAwesome5Free-Solid';
  src: url('/fonts/FontAwesome5_Solid.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'FontAwesome5Free-Brand';
  src: url('/fonts/FontAwesome5_Brands.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'FontAwesome5Free';
  src: url('/fonts/FontAwesome5_Solid.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'MaterialIcons';
  src: url('/fonts/MaterialIcons.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'MaterialCommunityIcons';
  src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'FontAwesome';
  src: url('/fonts/FontAwesome.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Feather';
  src: url('/fonts/Feather.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'AntDesign';
  src: url('/fonts/AntDesign.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;

/**
 * Root HTML template for Expo Router Web export.
 *
 * This injects the vector icon `@font-face` rules and preloads into the static
 * HTML `<head>` using `/fonts/*.ttf` (served from `public/fonts/`). This resolves
 * the issue where Vercel and web browsers block or fail to resolve asset paths
 * referencing `node_modules/@expo/vector-icons/...`.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0E9F8E" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="HealPoint" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        <link
          rel="preload"
          href="/fonts/Ionicons.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/FontAwesome5_Solid.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/FontAwesome5_Brands.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />

        <ScrollViewStyleReset />

        <style
          id="expo-generated-fonts"
          dangerouslySetInnerHTML={{ __html: iconFontStyles }}
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

