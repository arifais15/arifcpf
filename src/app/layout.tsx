import type {Metadata} from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { SweetAlertProvider } from '@/components/sweet-alert-provider';
import AuthWrapper from '@/components/auth-wrapper';
import { Separator } from '@/components/ui/separator';
import { HeaderActionsProvider, HeaderActionsDisplay } from '@/components/header-actions';
import { ShieldCheck } from 'lucide-react';

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
        {/* CDN Dependencies removed for 100% Offline Portability */}
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <SweetAlertProvider>
            <AuthWrapper>
              <HeaderActionsProvider>
                <SidebarProvider>
                  <AppSidebar />
                  <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 no-print sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                      <SidebarTrigger className="-ml-1" />
                      <Separator orientation="vertical" className="mr-2 h-4" />
                      <div className="flex-1 flex items-center overflow-hidden">
                        <HeaderActionsDisplay />
                      </div>
                    </header>
                    <main className="flex-1 min-h-screen relative">
                      {children}
                      {/* Local Distribution Badge */}
                      <div className="local-mode-banner no-print">
                        <ShieldCheck className="size-3" />
                        Institutional Local Mode Active
                      </div>
                    </main>
                  </SidebarInset>
                </SidebarProvider>
              </HeaderActionsProvider>
            </AuthWrapper>
            <Toaster />
          </SweetAlertProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
