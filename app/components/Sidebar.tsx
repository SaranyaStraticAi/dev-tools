'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogOut, LogIn, Database, Search, Users, Code, BarChart3, Layers, FileBarChart, TrendingUp, Lock, MessageSquare, LineChart, Image, Link2, Network, LayoutGrid, ChevronDown, Mail, Video, GraduationCap, Download, Brain, Newspaper, Edit, ShieldCheck, Inbox, Puzzle } from 'lucide-react';
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

const navGroups = [
  {
    label: 'Users & Identity',
    items: [
      { name: 'User Directory',     href: '/user-directory',  icon: LayoutGrid },
      { name: 'Users',              href: '/users',           icon: Users },
      { name: 'User Reports',       href: '/user-reports',    icon: FileBarChart },
      { name: 'Clerk User Search',  href: '/clerk-search',    icon: Search },
    ],
  },
  {
    label: 'Trading & Brokers',
    items: [
      { name: 'MetaAPI Lookup',       href: '/metaapi-lookup',      icon: Layers },
      { name: 'MetaAPI Connections',  href: '/metaapi-connections', icon: Network },
      { name: 'Strategy Dashboard',   href: '/strategy-dashboard',  icon: LineChart },
      { name: 'Journal Dashboard',    href: '/journal-dashboard',   icon: TrendingUp },
    ],
  },
  {
    label: 'Analytics & Monitoring',
    items: [
      { name: 'Monitoring',     href: '/monitoring',     icon: BarChart3 },
      { name: 'Chat Analytics', href: '/chat-analytics', icon: MessageSquare },
    ],
  },
  {
    label: 'Data & Storage',
    items: [
      { name: 'PostgreSQL Viewer', href: '/',       icon: Database },
      { name: 'Envecl',            href: '/envecl', icon: Lock },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { name: 'Newsletter Tester',   href: '/newsletter-tester',   icon: Mail },
      { name: 'Saved Newsletters',   href: '/newsletter-tester/saved', icon: Inbox },
      { name: 'Edu Content Tester',  href: '/edu-content',         icon: GraduationCap },
      { name: 'Image Generator',     href: '/image-generator',     icon: Image },
      { name: 'Video Generator',     href: '/video-generator',     icon: Video },
      { name: 'Link Tracker',        href: '/link-tracker',        icon: Link2 },
      { name: 'Prompt Tester',       href: '/prompt',              icon: Code },
    ],
  },
  {
    label: 'Newsletter Pipeline',
    items: [
      { name: '01: Reddit Discoverer',   href: '/newsletter-tester/reddit-discover', icon: Search },
      { name: '02: Subreddit Selector',  href: '/newsletter-tester/pick-subreddits',  icon: Layers },
      { name: '03: Reddit Post Fetcher', href: '/newsletter-tester/fetch-posts',      icon: Download },
      { name: '04: AI Deep Analysis',    href: '/newsletter-tester/deep-analysis',    icon: Brain },
      { name: '05: Market News Fetcher', href: '/newsletter-tester/news-context',     icon: Newspaper },
      { name: '06: Newsletter Writer',   href: '/newsletter-tester/newsletter-writer', icon: Edit },
      { name: '07: Compliance Reviewer', href: '/newsletter-tester/compliance-review', icon: ShieldCheck },
      { name: '08: Newsletter Banner',   href: '/newsletter-tester/generate-banner',   icon: Image },
    ],
  },
  {
    label: 'Tuesday Puzzle Pipeline',
    items: [
      { name: '01: Reddit Discoverer',   href: '/newsletter-tester/reddit-discover', icon: Search },
      { name: '02: Subreddit Selector',  href: '/newsletter-tester/pick-subreddits',  icon: Layers },
      { name: '03: Reddit Post Fetcher', href: '/newsletter-tester/fetch-posts',      icon: Download },
      { name: '06b: Puzzle Writer',      href: '/newsletter-tester/puzzle-writer',    icon: Puzzle },
    ],
  },
  {
    label: 'Tools & Utilities',
    items: [
      { name: 'JSON Converter',   href: '/json-converter',   icon: Code },
    ],
  },
];


function CollapsibleNavGroup({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel asChild>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-md text-left hover:bg-sidebar-accent/40 transition-colors cursor-pointer"
        >
          <span>{label}</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>
      </SidebarGroupLabel>
      <SidebarGroupContent
        className={`grid transition-all duration-200 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden min-h-0">{children}</div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { instance, accounts } = useMsal();
  const [employeeAccount, setEmployeeAccount] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('employee_session');
    if (saved) setEmployeeAccount(saved);
  }, []);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(e => { console.error(e); });
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
          <p className="text-xs text-muted-foreground">Database & Auth Tools</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const groupHasActive = group.items.some((i) => i.href === pathname);
          return (
            <CollapsibleNavGroup key={group.label} label={group.label} defaultOpen={groupHasActive}>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </CollapsibleNavGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {currentAccount ? (
          <div className="flex flex-col gap-2 px-2 py-2">
            <div className="text-sm text-muted-foreground truncate font-medium">{currentAccount}</div>
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
