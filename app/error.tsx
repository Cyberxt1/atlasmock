'use client';
export default function ErrorPage({reset}:{reset:()=>void}) { return <main className="error-page"><h1>Unable to load the command centre</h1><p>Your saved records are safe. Please try again.</p><button onClick={reset}>Try again</button></main>; }
