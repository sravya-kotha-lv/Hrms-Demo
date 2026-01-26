import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNavbar } from "./TopNavbar";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

export const MainLayout = ({ children, title, breadcrumb }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-[260px] flex flex-col transition-all duration-300">
        <TopNavbar title={title} breadcrumb={breadcrumb} />
        <main className="flex-1 p-6 overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
