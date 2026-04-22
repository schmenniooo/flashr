export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "-0.04em",
        color: "var(--color-text)",
        lineHeight: 1,
      }}
    >
      flash
      <span
        style={{
          color: "var(--color-accent)",
          filter: "drop-shadow(0 0 9.6px rgba(108, 99, 255, 0.3))",
        }}
      >
        r
      </span>
    </span>
  );
}
