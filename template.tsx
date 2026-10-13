export default function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="route-stage"><div className="page-magic" aria-hidden="true" />{children}</div>;
}