import "./globals.css";

export const metadata = {
  title: "FlowUs GTD",
  description: "Read-only GTD dashboard backed by FlowUs"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
