type MotifProps = { kind: 'sun' } | { kind: 'stamp'; label: string };

/**
 * A page's one decorative motif, in the poster style. Pick the kind by what the page is for (DESIGN.md, "Motifs").
 * It positions itself against the app shell's `main`, so render it outside any other positioned element.
 * Decoration only: hidden from screen readers, never behind text, never on error or failure screens.
 */
export function Motif(props: MotifProps) {
  if (props.kind === 'sun') {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-10 -z-10 size-40 rounded-full bg-sun sm:-top-44 sm:-right-20 sm:size-80"
      />
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="pointer-events-none absolute top-0 right-2 -z-10 hidden size-48 -rotate-12 text-primary lg:block"
    >
      <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2" />
      <text
        x="100"
        y="109"
        textAnchor="middle"
        fill="currentColor"
        fontSize="26"
        fontWeight="800"
        letterSpacing="2"
      >
        {props.label.toUpperCase()}
      </text>
    </svg>
  );
}
