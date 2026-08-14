import type { Metadata } from "next";
import "./globals.css";
import ThemeRegistry from "@/components/ThemeRegistry";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
    title: "Analytic Genie - Enterprise Test Case Generation",
    description: "Analytic Genie - Autonomous multi-agent test case generation powered by GitHub Copilot",
    icons: {
        icon: "/icon.svg?v=3",
        shortcut: "/icon.svg?v=3",
    },
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/icon.svg?v=3" type="image/svg+xml" />
            </head>
            <body
                style={{
                    fontFamily:
                        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                }}
            >
                <ThemeRegistry>
                    <AppShell>{children}</AppShell>
                </ThemeRegistry>
            </body>
        </html>
    );
}
