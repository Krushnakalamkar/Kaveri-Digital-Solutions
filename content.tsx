import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Layers3 } from 'lucide-react';
import { Ic, categoryIcons, categoryIconNames } from '@/components/site/icons';

export type DataObject = Record<string, unknown>;
export function object(value: unknown): DataObject {
  return value && typeof value === 'object' ? value as DataObject : {};
}
export function list(value: unknown): DataObject[] {
  if (Array.isArray(value)) return value.map(object);
  const record = object(value);
  for (const key of ['items', 'data', 'services', 'projects', 'skills', 'messages']) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).map(object);
  }
  return [];
}
export function value(record: DataObject, ...keys: string[]): string {
  for (const key of keys) if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  return '';
}

export function techOf(project: DataObject): string[] {
  const t = project.technologies;
  if (Array.isArray(t)) return t.map(String).filter(Boolean);
  return typeof t === 'string' ? t.split(',').map(x => x.trim()).filter(Boolean) : [];
}

export function ServicesList({ data }: { data: unknown }) {
  const categories = list(data);
  return <div className="category-list">
    {categories.map((category, index) => {
      const name = value(category, 'name');
      const matching = list(category.services);
      return <details className="category-disclosure" key={value(category, 'id') || name}>
        <summary><span className="cat-ic"><Ic icon={categoryIconNames[value(category, 'icon')] || categoryIcons[name.toLowerCase()] || Layers3} size={20} /></span>{name}<span>{matching.length} SERVICES</span></summary>
        {matching.length > 0 ? <div className="category-services">{matching.map((service, i) =>
          <p key={value(service, 'id', 'slug') || `${index}-${i}`}><i>{String(i + 1).padStart(2, '0')}</i><Link href={`/services/${value(service, 'slug')}`}>{value(service, 'name', 'title')}</Link></p>
        )}</div> : <p className="service-category-note">No services currently available in this category.</p>}
        <Link href={`/services/${value(category, 'slug')}`} className="dark-text-link category-detail-link">Explore {name} <ArrowUpRight size={14} /></Link>
      </details>;
    })}
  </div>;
}

export function ProjectCards({ data }: { data: unknown }) {
  const rows = list(data).filter(project => {
    const status = value(project, 'status', 'publicationStatus').toLowerCase();
    return project.published === true || project.isPublished === true || status === 'published';
  });
  if (!rows.length) return <div className="empty-state"><span className="empty-label">PROJECTS</span><h2>I haven’t shared project details here yet.</h2><p>No project write-ups are currently published on this portfolio.</p></div>;
  return <div className="project-list">{rows.map((project, index) => {
    const slug = value(project, 'slug', 'id');
    const name = value(project, 'title', 'name') || 'Project';
    return <article className="project-row" key={slug || index}>{value(project, 'imageUrl') ? <div className="project-cover-img"><Image src={value(project, 'imageUrl')} alt={value(project, 'imageAlt') || `${name} project image`} fill sizes="(max-width: 767px) 100vw, 600px" /></div> : <div className="project-cover" aria-hidden="true">KK<span>.</span></div>}<div className="project-info"><span className="eyebrow">{value(project, 'category', 'type')}</span><h2>{name}</h2><p>{value(project, 'summary', 'shortDescription', 'description')}</p>{techOf(project).length ? <div className="tech-list">{techOf(project).map(t => <span key={t}>{t}</span>)}</div> : null}{slug ? <Link href={`/work/${slug}`}>View case study <ArrowUpRight size={14} /></Link> : null}</div></article>;
  })}</div>;
}

export function CaseStudyFramework({ project }: { project: DataObject }) {
  const steps = [
    ['01', 'Challenge', value(project, 'challenge')],
    ['02', 'Approach', value(project, 'approach')],
    ['03', 'Development', value(project, 'development', 'process')],
    ['04', 'Result', value(project, 'result', 'outcome')],
  ];
  return <div className="case-framework">{steps.map(([number, title, detail]) =>
    <section className="case-step" key={number}><b>{number}</b><h3>{title}</h3>{detail ? <p>{detail}</p> : null}</section>
  )}</div>;
}
