import type {Metadata} from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { SweetAlertProvider } from '@/components/sweet-alert-provider';
import AuthWrapper from '@/components/auth-wrapper';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'PBS CPF Management',
  description: 'Management Accounting Software for Contributory Provident Fund',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <SweetAlertProvider>
            <AuthWrapper>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 no-print sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-50 hidden sm:block">
                        CPF Management Software
                      </p>
                    </div>
                  </header>
                  <main className="flex-1 min-h-screen">
                    {children}
                  </main>
                </SidebarInset>
              </SidebarProvider>
            </AuthWrapper>
            <Toaster />
          </SweetAlertProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
