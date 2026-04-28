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
                  <SidebarInset className="flex flex-col h-svh overflow-hidden">
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 no-print sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                      <SidebarTrigger className="-ml-1" />
                      <Separator orientation="vertical" className="mr-2 h-4" />
                      <div className="flex-1 flex items-center overflow-hidden">
                        <HeaderActionsDisplay />
                      </div>
                    </header>
                    <main className="flex-1 overflow-auto relative">
                      {children}
                      {/* Local Distribution Badge */}
                      <div className="local-mode-banner no-print">
                        <ShieldCheck className="size-3" />
                        Active
                      </div>
                    </main>
                    <footer className="h-8 shrink-0 border-t bg-background flex items-center px-6 no-print z-40">
                    <p className="inline-block px-3 py-1 bg-blue-50/50 border border-gray-200 rounded text-[9px] font-black uppercase tracking-widest text-gray-500">
  Developed by Ariful Islam, AGM Finance, Gazipur PBS-2
</p>
                    </footer>
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
