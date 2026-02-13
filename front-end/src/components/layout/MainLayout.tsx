import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNavbar } from "./TopNavbar";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

type HeaderState = {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
};

type MainLayoutContextValue = {
  setHeader: (header: HeaderState) => void;
};

const MainLayoutContext = createContext<MainLayoutContextValue | null>(null);

export const MainLayout = ({ children, title, breadcrumb }: MainLayoutProps) => {
  const parentLayout = useContext(MainLayoutContext);
  const [header, setHeader] = useState<HeaderState>({ title, breadcrumb });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!parentLayout) {
      setHeader({ title, breadcrumb });
      return;
    }
    parentLayout.setHeader({ title, breadcrumb });
  }, [parentLayout, title, breadcrumb]);

  const contextValue = useMemo<MainLayoutContextValue>(() => ({ setHeader }), []);

  if (parentLayout) {
    return <>{children}</>;
  }

  return (
    <MainLayoutContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
        <div className="flex-1 min-w-0 flex flex-col lg:ml-[260px] transition-all duration-300">
          <TopNavbar
            title={header.title}
            breadcrumb={header.breadcrumb}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />
          <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6 overflow-y-auto overflow-x-hidden animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </MainLayoutContext.Provider>
  );
};