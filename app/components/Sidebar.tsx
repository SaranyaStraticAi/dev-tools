'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock, LogOut, LogIn, Database, Search, Users, Code, BarChart3 } from 'lucide-react';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
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
    name: 'Users',
    href: '/users',
    icon: Users,
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
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { instance, accounts } = useMsal();

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(e => {
      console.error(e);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup();
  };

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
        <AuthenticatedTemplate>
          <div className="flex flex-col gap-2 px-2 py-2">
            <div className="text-sm text-muted-foreground truncate">
              {accounts[0]?.username}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </AuthenticatedTemplate>
        <UnauthenticatedTemplate>
          <div className="px-2 py-2">
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <LogIn size={16} />
              Login
            </button>
          </div>
        </UnauthenticatedTemplate>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
