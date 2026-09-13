// The generated layer first — tokens, then primitives, then this surface's
// own layout. Both files are emitted from constants/theme.ts by
// `npm run build:tokens`; never hand-edit them. (design-system-spec §3 rule 7)
import "./tokens.css";
import "./sticker.css";
import "./globals.css";

export const metadata = {
  title: "Tickle the Pig — Analytics",
  description: "Internal usage dashboard",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
