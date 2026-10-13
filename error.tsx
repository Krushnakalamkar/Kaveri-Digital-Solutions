"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="page-hero" style={{ minHeight: "100vh" }}>
    <p className="eyebrow">Temporarily unavailable</p>
    <h1>This page couldn’t load.</h1>
    <p>Please try again. You can also get in touch directly at kalamkarkrushna007@gmail.com.</p>
    <button className="button-light focus-ring" type="button" onClick={reset}>Try again</button>
  </main>;
}