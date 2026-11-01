export default function RankEmblem({
  index = 0,
  size = 116,
}: {
  index?: number;
  size?: number;
}) {
  const tier = Math.floor(index / 3),
    division = (index % 3) + 1;
  const colors = [
    "#b8c4ce",
    "#94aab8",
    "#b7b5a6",
    "#75acc7",
    "#9d9cdb",
    "#d6b968",
    "#d99669",
    "#f6cf72",
  ];
  const c = colors[tier] ?? colors[0];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label={`Original rank emblem, tier ${tier + 1}, division ${division}`}
    >
      <defs>
        <linearGradient id={`metal${index}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={c} />
          <stop offset=".5" stopColor="#e4e8ec" />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <path
        d="M80 9 136 40 131 101 80 148 29 101 24 40Z"
        fill="#17212d"
        stroke={c}
        strokeWidth="2"
      />
      <path
        d="m80 20 44 26-5 49-39 38-39-38-5-49Z"
        fill="none"
        stroke={c}
        opacity=".35"
      />
      <path
        d="m24 59 36 19-1 15-32-17m-2 9 36 20 5 17-36-22m106-41-36 19 1 15 32-17m2 9-36 20-5 17 36-22"
        fill={c}
        opacity=".6"
      />
      <path d="m80 38 30 17v29L80 111 50 84V55Z" fill={`url(#metal${index})`} />
      <path d="m80 49 19 11v19L80 97 61 79V60Z" fill="#1b2530" />
      <path d="m80 57 13 8-4 15-9 8-9-8-4-15Z" fill={c} />
      {Array.from({ length: division }, (_, n) => (
        <path
          key={n}
          d={`m${66 + n * 12 - (division - 1) * 6} 119 6-5 6 5-6 5Z`}
          fill={c}
        />
      ))}
      {tier > 2 && <path d="m65 31 15-16 15 16-15-6Z" fill={c} />}
    </svg>
  );
}
