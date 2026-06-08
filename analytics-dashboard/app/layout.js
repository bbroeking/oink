import "./globals.css";

export const metadata = {
  title: "Tickle the Pig — Analytics",
  description: "Internal usage dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
