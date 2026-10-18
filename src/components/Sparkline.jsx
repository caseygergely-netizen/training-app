/** Tiny SVG sparkline for the leaderboard. data: number[] */
export default function Sparkline({ data, width = 72, height = 26, color = "#c6ff4a" }) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} />;
  }
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 3) - 1.5).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
