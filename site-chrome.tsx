'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTheme } from 'next-themes';
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react';
import { RevealObserver } from '@/components/site/reveal';
import VisitorIntake from '@/components/site/visitor-intake';
import { Ic, navIcons, Instagram, Linkedin, Mail, Phone } from '@/components/site/icons';
import { useSiteProfile } from '@/components/site/site-data';

const nav = [
  ['Home', '/'], ['About', '/about'], ['Services', '/services'],
  ['Work', '/work'], ['Skills', '/#skills'], ['Resume', '/resume'], ['Contact', '/contact'],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = !mounted || resolvedTheme !== 'light';
  const profile = useSiteProfile();

  useEffect(() => setMounted(true), []);

  return <header className="public-header">
    <div className="public-header-inner">
      <Link href="/" className="public-brand focus-ring" onClick={() => setOpen(false)} aria-label={`${profile.companyName} — home`}>
        <Image src="/images/kaveri-logo.png" alt="" aria-hidden="true" width={430} height={440} sizes="(max-width: 767px) 72px, 92px" priority className="public-brand-logo public-brand-logo-dark" />
        <Image src="/images/kaveri-footer-light.png" alt="" aria-hidden="true" width={581} height={537} sizes="(max-width: 767px) 72px, 92px" className="public-brand-logo public-brand-logo-light" />
        <span className="public-brand-copy"><b>{profile.companyName}</b><small>{profile.name}</small></span>
      </Link>
      <nav className={`public-nav ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        {nav.map(([label, href]) => <Link key={label} href={href} onClick={() => setOpen(false)}><Ic icon={navIcons[label]} size={15} />{label}</Link>)}
        <Link className="public-hire" href="/contact" onClick={() => setOpen(false)}>Hire Me <ArrowUpRight size={15} /></Link>
      </nav>
      <div className="public-header-actions">
        <button
          type="button"
          className="public-theme-toggle focus-ring"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
        <button type="button" className="public-menu-button focus-ring" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} onClick={() => setOpen(v => !v)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </div>
  </header>;
}

export function SiteFooter() {
  const profile = useSiteProfile();
  return <footer className="public-footer">
    <div className="public-footer-main">
      <div>
        <Link href="/" className="public-brand public-footer-brand" aria-label={`Go to ${profile.companyName} homepage`}>
          <Image src="/images/kaveri-footer-light.png" alt="" aria-hidden="true" loading="lazy" width={581} height={537} sizes="146px" className="public-brand-logo public-brand-logo-footer public-brand-logo-footer-light" />
          <Image src="/images/kaveri-footer-dark.png" alt="" aria-hidden="true" loading="lazy" width={396} height={418} sizes="146px" className="public-brand-logo public-brand-logo-footer public-brand-logo-footer-dark" />
        </Link>
        <p>{profile.professionalTitle}<br />{profile.location}</p>
      </div>
      <div className="footer-link-column"><h2>Explore</h2>{nav.map(([label, href]) => <Link href={href} key={label}><Ic icon={navIcons[label]} size={14} />{label}</Link>)}</div>
      <div className="footer-link-column"><h2>Get in touch</h2>
        <a href={`mailto:${profile.email}`}><Ic icon={Mail} size={14} />{profile.email}</a>
        <a href={`mailto:${profile.businessEmail}`}><Ic icon={Mail} size={14} />{profile.businessEmail}</a>
        <a href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`}><Ic icon={Phone} size={14} />{profile.phone}</a>
        {profile.socialLinks.map(link => <a key={link.platform} href={link.url} target="_blank" rel="noreferrer"><Ic icon={link.platform === 'instagram' ? Instagram : Linkedin} size={14} />{link.label}</a>)}
        <Link href="/privacy">Privacy notice</Link>
      </div>
    </div>
    <div className="footer-fine"><span>© {new Date().getFullYear()} {profile.companyName}. All rights reserved.</span><span>{profile.name.toUpperCase()}</span></div>
  </footer>;
}

export function Portrait() {
  const profile = useSiteProfile();
  if (!profile.photoUrl) return null;
  const resetTilt = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--portrait-tilt-x', '0deg');
    event.currentTarget.style.setProperty('--portrait-tilt-y', '0deg');
  };
  const handleTilt = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      resetTilt(event);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    event.currentTarget.style.setProperty('--portrait-tilt-x', `${(-y * 4.25).toFixed(2)}deg`);
    event.currentTarget.style.setProperty('--portrait-tilt-y', `${(x * 6).toFixed(2)}deg`);
  };
  return <figure className="hero-portrait" onPointerMove={handleTilt} onPointerLeave={resetTilt} onPointerCancel={resetTilt}>
    <div className="hero-image-wrap"><Image src={profile.photoUrl} alt={`Portrait of ${profile.name}`} fill priority sizes="(max-width: 767px) 90vw, 42vw" /></div>
    <figcaption className="hero-image-label"><span>{profile.name}</span><span>{profile.location}</span></figcaption>
  </figure>;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return <><div className="site-public"><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader /><main id="main-content" className="public-main">{children}</main><SiteFooter /><RevealObserver /></div><VisitorIntake /></>;
}

export function PageHero({ eyebrow, title, subtitle }: { eyebrow: string; title: React.ReactNode; subtitle?: string }) {
  return <section className="page-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</section>;
}
