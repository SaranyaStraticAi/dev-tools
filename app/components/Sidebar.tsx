'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogOut, LogIn, Database, Search, Users, Code, BarChart3, Layers, FileBarChart, TrendingUp, Lock, MessageSquare, LineChart, Image, Link2, Network, LayoutGrid } from 'lucide-react';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { useState, useEffect } from 'react';

import { loginRequest } from "@/lib/authConfig";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navItems = [
  {
    name: 'PostgreSQL Viewer',
    href: '/',
    icon: Database,
  },
  {
    name: 'Envecl',
    href: '/envecl',
    icon: Lock,
  },
  {
    name: 'Clerk User Search',
    href: '/clerk-search',
    icon: Search,
  },
  {
    name: 'MetaAPI Lookup',
    href: '/metaapi-lookup',
    icon: Layers,
  },
  {
    name: 'MetaAPI Connections',
    href: '/metaapi-connections',
    icon: Network,
  },
  {
    name: 'Users',
    href: '/users',
    icon: Users,
  },
  {
    name: 'User Directory',
    href: '/user-directory',
    icon: LayoutGrid,
  },
  {
    name: 'User Reports',
    href: '/user-reports',
    icon: FileBarChart,
  },
  {
    name: 'JSON Converter',
    href: '/json-converter',
    icon: Code,
  },
  {
    name: 'Monitoring',
    href: '/monitoring',
    icon: BarChart3,
  },
  {
    name: 'Prompt Tester',
    href: '/prompt',
    icon: Code,
  },
  {
    name: 'Journal Dashboard',
    href: '/journal-dashboard',
    icon: TrendingUp,
  },
  {
    name: 'Chat Analytics',
    href: '/chat-analytics',
    icon: MessageSquare,
  },
  {
    name: 'Strategy Dashboard',
    href: '/strategy-dashboard',
    icon: LineChart,
  },
  {
    name: 'Image Generator',
    href: '/image-generator',
    icon: Image,
  },
  {
    name: 'Link Tracker',
    href: '/link-tracker',
    icon: Link2,
  },
];


export default function AppSidebar() {
  const pathname = usePathname();
  const { instance, accounts } = useMsal();
  const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('employee_session');
    if (saved) setEmployeeAccount(saved);
  }, []);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(e => {
      console.error(e);
    });
  };

  const handleLogout = () => {
    if (employeeAccount) {
      localStorage.removeItem('employee_session');
      window.location.reload();
    } else {
      instance.logoutPopup();
    }
  };

  const currentAccount = accounts[0]?.username || employeeAccount;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-1 px-2 py-2">
          <h2 className="text-lg font-bold">Dev Tools</h2>
          <p className="text-xs text-muted-foreground">
            Database & Auth Tools
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {currentAccount ? (
          <div className="flex flex-col gap-2 px-2 py-2">
            <div className="text-sm text-muted-foreground truncate font-medium">
              {currentAccount}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors group"
            >
              <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              Logout
            </button>
          </div>
        ) : (
          <div className="px-2 py-2">
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <LogIn size={16} />
              Login
            </button>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
