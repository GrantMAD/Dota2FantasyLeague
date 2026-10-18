import React from 'react';

interface PriceSparklineProps {
  /**
   * Array of prices ordered chronologically from oldest to newest.
   * e.g. [7.5, 7.5, 7.8, 8.0]
   */
  data?: number[] | null;
  /** Width in SVG units / pixels (default 56) */
  width?: number;
  /** Height in SVG units / pixels (default 18) */
  height?: number;
  /** Stroke width in pixels (default 1.75) */
  strokeWidth?: number;
  /** Optional class name to attach to wrapper span */
  className?: string;
  /** Whether to show a dot on the latest price point (default true) */
  showEndpoint?: boolean;
}

export interface PriceSparklineModel {
  points: number[];
  trend: 'up' | 'down' | 'flat';
  strokeColor: string;
  fillColor: string;
  coords: { x: number; y: number; val: number }[];
  pathData: string;
  areaPathData: string;
  ariaLabel: string;
}

export function getPriceSparklineData(
  data?: number[] | null,
  width: number = 56,
  height: number = 18,
  paddingX: number = 3,
  paddingY: number = 3,
): PriceSparklineModel {
  const points = (data ?? []).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    const diff = Number((last - first).toFixed(2));
    if (diff > 0) trend = 'up';
    else if (diff < 0) trend = 'down';
  }

  const strokeColor =
    trend === 'up'
      ? '#34d399' // emerald-400
      : trend === 'down'
        ? '#fb7185' // rose-400
        : '#64748b'; // slate-500

  const fillColor =
    trend === 'up'
      ? 'rgba(52, 211, 153, 0.15)'
      : trend === 'down'
        ? 'rgba(251, 113, 133, 0.15)'
        : 'rgba(100, 116, 139, 0.1)';

  const usableWidth = Math.max(1, width - paddingX * 2);
  const usableHeight = Math.max(1, height - paddingY * 2);

  if (points.length <= 1) {
    const label = points.length === 1 ? `Price steady at $${points[0].toFixed(1)}M` : 'No price trend data';
    return {
      points,
      trend,
      strokeColor,
      fillColor,
      coords: [],
      pathData: '',
      areaPathData: '',
      ariaLabel: label,
    };
  }

  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const valRange = maxVal - minVal;

  const coords = points.map((val, index) => {
    const x = paddingX + (index / (points.length - 1)) * usableWidth;
    const y =
      valRange === 0
        ? height / 2
        : paddingY + (1 - (val - minVal) / valRange) * usableHeight;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), val };
  });

  const pathData = coords.reduce((acc, curr, index) => {
    return `${acc} ${index === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`;
  }, '');

  const lastCoord = coords[coords.length - 1];
  const firstCoord = coords[0];
  const areaPathData = `${pathData} L ${lastCoord.x} ${height} L ${firstCoord.x} ${height} Z`;
  const ariaLabel = `Price trend: ${trend} from $${firstCoord.val.toFixed(1)}M to $${lastCoord.val.toFixed(1)}M across ${points.length} gameweeks`;

  return {
    points,
    trend,
    strokeColor,
    fillColor,
    coords,
    pathData,
    areaPathData,
    ariaLabel,
  };
}

export function PriceSparkline({
  data,
  width = 56,
  height = 18,
  strokeWidth = 1.75,
  className = '',
  showEndpoint = true,
}: PriceSparklineProps) {
  const paddingX = 3;
  const paddingY = 3;
  const model = getPriceSparklineData(data, width, height, paddingX, paddingY);
  const { points, strokeColor, fillColor, coords, pathData, areaPathData, ariaLabel } = model;

  if (points.length <= 1) {
    const y = height / 2;
    return (
      <span
        className={`inline-flex items-center ${className}`}
        title={ariaLabel}
        aria-label={ariaLabel}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          <line
            x1={paddingX}
            y1={y}
            x2={width - paddingX}
            y2={y}
            stroke="#475569"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
          {points.length === 1 && (
            <circle
              cx={width - paddingX}
              cy={y}
              r={2}
              fill="#94a3b8"
            />
          )}
        </svg>
      </span>
    );
  }

  const lastCoord = coords[coords.length - 1];

  return (
    <span
      className={`inline-flex items-center ${className}`}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Subtle area fill */}
        <path d={areaPathData} fill={fillColor} />
        {/* Trend line */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Endpoint marker */}
        {showEndpoint && lastCoord && (
          <circle
            cx={lastCoord.x}
            cy={lastCoord.y}
            r={strokeWidth + 0.5}
            fill={strokeColor}
          />
        )}
      </svg>
    </span>
  );
}
