import {
  ArrowUpRight, BarChart3, BrainCircuit, Briefcase, Code2, FileText, Globe, Home,
  Inbox, Instagram, LayoutDashboard, Layers, Linkedin, LogOut, Mail, Palette, PenLine, Send,
  Phone, Settings, Sparkles, UserRound, Wrench, FolderKanban, LifeBuoy, ShieldCheck, type LucideIcon,
} from 'lucide-react';

/* One icon language: lucide, 1.75 stroke, 16px default, decorative. */
export function Ic({ icon: Icon, size = 16 }: { icon: LucideIcon; size?: number }) {
  return <Icon className="ic" size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}

export const categoryIcons: Record<string, LucideIcon> = {
  'web & technology': Code2,
  'ai & digital': BrainCircuit,
  creative: Palette,
  'data & office': BarChart3,
  content: PenLine,
  'digital support': LifeBuoy,
};
export const categoryIconNames: Record<string, LucideIcon> = {
  monitor: Code2, 'code-2': Code2, sparkles: BrainCircuit, 'brain-circuit': BrainCircuit,
  'pen-tool': Palette, palette: Palette, table: BarChart3, 'bar-chart-3': BarChart3,
  text: PenLine, 'pen-line': PenLine, 'life-buoy': LifeBuoy, globe: Globe,
  'file-text': FileText, briefcase: Briefcase,
};

export const navIcons: Record<string, LucideIcon> = {
  Home, About: UserRound, Services: Layers, Work: FolderKanban, Skills: BrainCircuit,
  Resume: FileText, Contact: Send,
};

export const adminIcons = {
  dashboard: LayoutDashboard, projects: FolderKanban, services: Wrench, messages: Inbox,
  skills: Sparkles, profile: UserRound, resume: FileText, settings: Settings, visitorRequests: ShieldCheck,
  logout: LogOut, site: Globe,
};

export { ArrowUpRight, Instagram, Linkedin, Mail, Phone };
