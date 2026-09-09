import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import ThemeRegistry from "@/components/ThemeRegistry";
import AppShell from "@/components/AppShell";
import type { ColorMode } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
    title: "Agent HUB Platform — Enterprise Multi-Agent Orchestration",
    description: "Agent HUB Platform — Onboard, orchestrate, and run autonomous multi-agent workflows, skills, and prompts. Includes a universal Agent Console and bespoke use-case UIs.",
    icons: {
        icon: "/CTSH.svg",
        shortcut: "/CTSH.svg",
    },
};

/**
 * Runs before paint so CSS variables and the theme cookie agree with what the
 * server used for MUI. Without this, a stored dark preference hydrates against
 * light Emotion class names and React reports a nav-button mismatch.
 */
const themeBootScript = `
(function () {
  try {
    var key = 'themeMode';
    var m = localStorage.getItem(key);
    if (m !== 'light' && m !== 'dark') {
      m = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', m);
    document.documentElement.style.colorScheme = m;
    document.cookie = key + '=' + m + ';path=/;max-age=31536000;SameSite=Lax';
  } catch (e) {}
})();
`;

export default async function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const jar = await cookies();
    const raw = jar.get("themeMode")?.value;
    const initialMode: ColorMode = raw === "dark" || raw === "light" ? raw : "light";

    return (
        <html lang="en" data-theme={initialMode} style={{ colorScheme: initialMode }} suppressHydrationWarning>
            <head>
                <link rel="icon" href="/CTSH.svg" type="image/svg+xml" />
                <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
            </head>
            <body>
                <ThemeRegistry initialMode={initialMode}>
                    <AppShell>{children}</AppShell>
                </ThemeRegistry>
            </body>
        </html>
    );
}
