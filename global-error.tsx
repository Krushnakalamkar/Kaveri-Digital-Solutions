"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return <html lang="en"><body style={{ margin: 0, padding: "10vh 8vw", background: "#08111f", color: "#fff", fontFamily: "system-ui" }}>
    <h1>This page is temporarily unavailable.</h1>
    <p>Please try again or contact kalamkarkrushna007@gmail.com.</p>
    <button onClick={reset} style={{ padding: "14px 20px", background: "#6d001a", color: "#fff", border: 0 }}>Try again</button>
  </body></html>;
}