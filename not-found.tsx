import Link from "next/link";
import { PageHero, SiteShell } from "@/components/site/site-chrome";

export default function NotFound() {
  return <SiteShell>
    <PageHero eyebrow="404 / Not found" title={<>This page isn’t here.</>} subtitle="The link may have changed, or the page is not published." />
    <section className="content-section"><Link href="/" className="button-primary focus-ring">Return home</Link></section>
  </SiteShell>;
}