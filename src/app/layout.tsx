import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripFit AI",
  description: "두 여행 일정을 같은 기준으로 비교합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Maze Website Test universal snippet — every page goes through
            this root layout, so this is the one place that loads it
            site-wide. strategy="beforeInteractive" is Next.js's supported
            equivalent of Maze's "place immediately after <head>"
            instruction: Next.js injects it into the document <head> and
            runs it before hydration/any other script, regardless of where
            in the tree it's declared — a raw <head><script> tag isn't
            valid JSX here (script can't be a sibling of <body>, only a
            child of <head>/<body>) and isn't the Next.js-recommended path
            for third-party scripts anyway. Snippet body is verbatim from
            Maze's install guide — do not edit. */}
        <Script id="maze-universal-snippet" strategy="beforeInteractive">
          {`
(function (m, a, z, e) {
  var s, t, u, v;
  try {
    t = m.sessionStorage.getItem('maze-us');
  } catch (err) {}

  if (!t) {
    t = new Date().getTime();
    try {
      m.sessionStorage.setItem('maze-us', t);
    } catch (err) {}
  }

  u = document.currentScript || (function () {
    var w = document.getElementsByTagName('script');
    return w[w.length - 1];
  })();
  v = u && u.nonce;

  s = a.createElement('script');
  s.src = z + '?apiKey=' + e;
  s.async = true;
  if (v) s.setAttribute('nonce', v);
  a.getElementsByTagName('head')[0].appendChild(s);
  m.mazeUniversalSnippetApiKey = e;
})(window, document, 'https://snippet.maze.co/maze-universal-loader.js', 'efc4065b-c878-4665-918f-f7e1f91411e9');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
