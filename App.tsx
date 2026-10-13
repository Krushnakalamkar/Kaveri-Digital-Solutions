import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BrainCircuit, Check, Code2,
  Instagram, Layers3, Linkedin, MapPin, Menu, MessageCircle,
  Monitor, PenTool, Phone, Sparkles, X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    ['Home', '#home'], ['About', '#about'], ['Services', '#services'],
    ['Work', '#work'], ['Skills', '#skills'], ['Resume', '#resume'], ['Contact', '#contact'],
  ];
  const services = [
    ['01', 'Web development', 'Modern, responsive websites built around clarity and purpose.', Code2],
    ['02', 'AI-led solutions', 'Practical AI integrations that make digital work more useful.', BrainCircuit],
    ['03', 'Digital experiences', 'Thoughtful interfaces that make complex journeys feel simple.', Monitor],
    ['04', 'Creative solutions', 'Professional creative support for a sharper digital presence.', PenTool],
    ['05', 'Website design', 'Distinctive layouts with a clear visual point of view.', Layers3],
    ['06', 'Digital strategy', 'A considered path from early idea to a confident online presence.', Sparkles],
    ['07', 'Technology consulting', 'Clear guidance for choosing and shaping digital tools.', MessageCircle],
  ] as const;
  const capabilities = [
    'Website development', 'Responsive interfaces', 'AI integrations', 'Digital product thinking',
    'Frontend experiences', 'Creative digital solutions', 'Technology consulting', 'Website design',
    'Workflow automation', 'Digital strategy',
  ];
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="portfolio min-h-[100dvh]">
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="nav-inner">
          <a className="brand focus-ring" href="#home" onClick={closeMenu} aria-label="Krushna Kalamkar home" data-testid="link-brand">
            <span className="brand-mark">KK<span>.</span></span>
            <span className="brand-copy"><b>KRUSHNA KALAMKAR</b><small>Developer &amp; AI Engineer</small></span>
          </a>
          <nav className={`desktop-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
            {links.map(([label, href]) => <a key={href} href={href} onClick={closeMenu} className="nav-link focus-ring" data-testid={`link-nav-${label.toLowerCase()}`}>{label}</a>)}
            <a className="mobile-hire" href="#contact" onClick={closeMenu}>Hire Me <ArrowUpRight size={15} /></a>
          </nav>
          <a className="hire-button focus-ring" href="#contact" data-testid="link-hire-me">Hire Me <ArrowUpRight size={16} /></a>
          <button className="menu-toggle focus-ring" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} data-testid="button-mobile-menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-grain" aria-hidden="true" />
          <div className="hero-inner section-shell">
            <div className="hero-copy">
              <div className="availability hero-enter"><span className="availability-dot" /> AVAILABLE FOR FREELANCE PROJECTS <span className="availability-rule" /></div>
              <p className="hero-kicker hero-enter-delay">Freelance Digital Solutions</p>
              <h1 className="display hero-title hero-enter-delay">Ideas, meet<br /><em>what’s next.</em></h1>
              <h2 className="hero-name hero-enter-delay">KRUSHNA KALAMKAR</h2>
              <p className="hero-role">Developer &amp; AI Engineer <span className="role-divider">/</span> Maharashtra, India</p>
              <p className="hero-intro">Building Digital Solutions That Move Your Ideas Forward.</p>
              <p className="hero-description">I build modern websites, AI-powered solutions, digital experiences and professional creative solutions for individuals and businesses.</p>
              <div className="hero-actions">
                <a className="button-primary focus-ring" href="#contact" data-testid="link-hero-hire">Let’s work together <ArrowUpRight size={17} /></a>
                <a className="button-text focus-ring" href="#work" data-testid="link-view-work">View my work <ArrowDown size={15} /></a>
              </div>
              <div className="hero-facts" aria-label="Professional highlights">
                <div><b>3+</b><span>Years Experience</span></div>
                <div><b>30+</b><span>Digital Skills</span></div>
                <div><b>7+</b><span>Service Categories</span></div>
                <div className="fact-location"><MapPin size={15} /><span>Maharashtra, India</span></div>
              </div>
            </div>
            <div className="hero-visual hero-enter-delay">
              <div className="portrait-frame portrait-placeholder" role="img" aria-label="Portrait photograph placeholder for Krushna Kalamkar">
                <span className="frame-index">PROFILE / 01</span>
                <div className="portrait-placeholder-content">
                  <div className="portrait-outline"><span>KK</span></div>
                  <p>PORTRAIT PLACEHOLDER</p>
                  <small>Real portrait to be added</small>
                </div>
                <span className="frame-caption">KRUSHNA KALAMKAR <i>—</i> INDIA</span>
              </div>
              <div className="visual-note"><span className="note-line" /><span>Independent thinking.<br />Studio-level delivery.</span></div>
              <div className="hero-coordinate">18°31' N&nbsp; 73°51' E</div>
            </div>
          </div>
          <div className="hero-bottom section-shell"><span>INDEPENDENT BY CHOICE. COLLABORATIVE BY NATURE.</span><a href="#about" aria-label="Scroll to About"><ArrowDown size={16} /></a><span>01 — 07</span></div>
        </section>

        <section className="about-section section-pad" id="about">
          <div className="section-shell about-layout">
            <div className="section-index"><span>01</span><i /></div>
            <div className="about-main">
              <p className="eyebrow burgundy">A little about how I work</p>
              <h2 className="display section-heading">Good digital work<br />starts with <em>good questions.</em></h2>
              <div className="about-copy-grid">
                <p>I’m Krushna Kalamkar, a developer and AI engineer working with people and businesses to move ideas forward through digital solutions.</p>
                <p>My focus is bringing thoughtful development and emerging technology together—making things that are useful, considered and ready for the real world.</p>
              </div>
              <div className="about-signoff"><span className="signoff-rule" /><span>Working independently, collaborating closely.</span></div>
            </div>
            <aside className="about-aside">
              <span className="aside-number">03<span>+</span></span>
              <span className="aside-caption">YEARS EXPERIENCE</span>
              <span className="aside-separator" />
              <p>Professional focus<br />on digital solutions</p>
              <a href="#contact" className="aside-link focus-ring">A project in mind? <ArrowUpRight size={15} /></a>
            </aside>
          </div>
        </section>

        <section className="services-section section-pad" id="services">
          <div className="section-shell">
            <div className="section-topline"><p className="eyebrow">02 / What I can help with</p><span>7+ SERVICE CATEGORIES</span></div>
            <div className="services-heading-row">
              <h2 className="display section-heading">From first thought<br />to <em>finished experience.</em></h2>
              <p>Digital work shaped around your goals, your people and the problem worth solving.</p>
            </div>
            <div className="service-list">
              {services.map(([number, title, description, Icon]) => (
                <article className="service-row" key={number}>
                  <span className="service-number">{number}</span><span className="service-icon"><Icon size={20} strokeWidth={1.5} /></span>
                  <div className="service-description"><h3>{title}</h3><p>{description}</p></div>
                  <a href="#contact" className="service-arrow focus-ring" aria-label={`Ask about ${title}`}><ArrowUpRight size={19} /></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="work-section section-pad" id="work">
          <div className="section-shell">
            <div className="section-topline"><p className="eyebrow">03 / Selected work</p><span>VERIFIED PROJECTS ONLY</span></div>
            <div className="work-layout">
              <div className="work-intro">
                <h2 className="display section-heading">Work, with<br /><em>room to grow.</em></h2>
                <p>This space is being held for selected, verified projects. No placeholders dressed up as case studies—just work worth showing, when it’s ready.</p>
                <a href="#contact" className="dark-text-link focus-ring">Have a project in mind? <ArrowRight size={16} /></a>
              </div>
              <div className="work-empty">
                <div className="empty-mark"><span>W</span><i /><i /></div>
                <div className="empty-status"><span className="status-line" /> PORTFOLIO IN PROGRESS</div>
                <p>Upcoming verified projects</p>
                <small>Selected work will appear here.</small>
                <span className="empty-index">SPACE RESERVED FOR VERIFIED WORK</span>
              </div>
            </div>
          </div>
        </section>

        <section className="skills-section section-pad" id="skills">
          <div className="section-shell skills-layout">
            <div className="skills-intro">
              <p className="eyebrow">04 / Skills &amp; approach</p>
              <h2 className="display section-heading">Curious by nature.<br /><em>Useful by design.</em></h2>
              <p>A flexible digital toolkit—applied with care, not for the sake of a trend.</p>
              <div className="skills-total"><b>30<span>+</span></b><small>DIGITAL SKILLS<br />AND GROWING</small></div>
            </div>
            <div className="skills-detail">
              <div className="skill-cloud">
                {capabilities.map((skill, i) => <span key={skill} className={`skill-tag ${i === 2 ? 'skill-accent' : ''}`}><i>{String(i + 1).padStart(2, '0')}</i>{skill}</span>)}
              </div>
              <div className="skills-footnote"><span className="tech-dot" /> PRACTICAL TECHNOLOGY. HUMAN OUTCOMES.</div>
            </div>
          </div>
        </section>

        <section className="resume-section section-pad" id="resume">
          <div className="section-shell resume-panel">
            <div className="resume-side"><p className="eyebrow">05 / Resume</p><span className="resume-watermark">CV</span></div>
            <div className="resume-content">
              <h2 className="display section-heading">The next chapter<br /><em>starts here.</em></h2>
              <p>Résumé details can be added here. For a current overview of my experience and fit, get in touch directly.</p>
              <a href="#contact" className="button-light focus-ring">Ask about my experience <ArrowUpRight size={16} /></a>
            </div>
            <span className="resume-mark"><Check size={18} /></span>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-top section-shell">
            <p className="eyebrow">06 / Contact</p>
            <span className="contact-location"><MapPin size={14} /> MAHARASHTRA, INDIA</span>
          </div>
          <div className="section-shell contact-main">
            <div className="contact-heading">
              <h2 className="display">Let’s make<br /><em>something matter.</em></h2>
              <p>Have a clear brief or just the beginning of an idea? Tell me where you want to go.</p>
            </div>
            <div className="contact-details">
              <a className="contact-primary focus-ring" href="mailto:kalamkarkrushna007@gmail.com"><span>PRIMARY EMAIL</span><b>kalamkarkrushna007@gmail.com</b><ArrowUpRight size={17} /></a>
              <a className="contact-secondary focus-ring" href="mailto:icondigital.pvt.ltd@gmail.com"><span>BUSINESS EMAIL</span><b>icondigital.pvt.ltd@gmail.com</b><ArrowUpRight size={17} /></a>
              <a className="contact-secondary focus-ring" href="tel:+917620702591"><span>PHONE</span><b>+91 7620702591</b><Phone size={16} /></a>
              <div className="social-links">
                <a className="social-link focus-ring" href="https://www.instagram.com/krushna_kalamkar_007/" target="_blank" rel="noreferrer" aria-label="Instagram profile"><Instagram size={17} /> Instagram <ArrowUpRight size={13} /></a>
                <a className="social-link focus-ring" href="https://www.linkedin.com/in/krushna-kalamkar-416895328/" target="_blank" rel="noreferrer" aria-label="LinkedIn profile"><Linkedin size={17} /> LinkedIn <ArrowUpRight size={13} /></a>
              </div>
            </div>
          </div>
          <footer className="site-footer section-shell">
            <a href="#home" className="footer-brand focus-ring"><span className="brand-mark">KK<span>.</span></span><span>KRUSHNA KALAMKAR</span></a>
            <span>DEVELOPER &amp; AI ENGINEER</span><a href="#home" className="back-top focus-ring">BACK TO TOP <ArrowUpRight size={14} /></a>
          </footer>
          <div className="footer-bottom"><span>FREELANCE DIGITAL SOLUTIONS</span><span>MADE WITH INTENTION · INDIA</span></div>
        </section>
      </main>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
