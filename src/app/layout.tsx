import type { Metadata } from "next";
import { RoleProvider } from "@/components/RoleProvider";
import "./globals.css";
export const metadata: Metadata = { title: "NovelVerse — Wireframe", description: "System design wireframe for NovelVerse by J007lnwza" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th"><body><RoleProvider>{children}</RoleProvider></body></html>}
