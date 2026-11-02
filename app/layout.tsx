import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import DisableRightClick from "./components/DisableRightClick";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Stella College | Student Portal",
  description: "Login to your Stella College student portal account.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Saved theme applied before the first paint; ThemeToggle flips it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("stella-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <DisableRightClick />
        {children}
      </body>
    </html>
  );
}
