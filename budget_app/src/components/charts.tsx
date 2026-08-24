/**
 * Charts, drawn with react-native-svg.
 *
 * Shared rules: one value axis per chart, hairline recessive grid, thin marks,
 * a 2px gap between adjacent fills, and text in theme ink rather than the
 * series colour — identity comes from the mark beside the label, never from
 * colouring the label itself.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../state/store.tsx';
import { spacing } from '../theme/index.ts';
import { Row, Txt } from './ui.tsx';

const GAP_PX = 2;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ringSegment(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startAngle: number,
  endAngle: number
): string {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const o1 = polar(cx, cy, outer, startAngle);
  const o2 = polar(cx, cy, outer, endAngle);
  const i1 = polar(cx, cy, inner, endAngle);
  const i2 = polar(cx, cy, inner, startAngle);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

export type DonutSlice = { id: string; label: string; value: number; color: string };

/**
 * Part-to-whole at a glance. Callers fold the tail into an "Other" slice —
 * a donut stops being readable past about six segments.
 */
export function DonutChart({
  slices,
  size = 200,
  thickness = 26,
  centerLabel,
  centerValue,
  selectedId,
  onSelect,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const theme = useTheme();
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 2;
  const inner = outer - thickness;

  const gapAngle = total > 0 && slices.length > 1 ? (GAP_PX / (2 * Math.PI * outer)) * 360 : 0;

  const segments = useMemo(() => {
    if (total <= 0) return [];
    let cursor = 0;
    return slices.map((slice) => {
      const sweep = (slice.value / total) * 360;
      const start = cursor + gapAngle / 2;
      const end = cursor + sweep - gapAngle / 2;
      cursor += sweep;
      return { slice, start, end: Math.max(start + 0.5, end) };
    });
  }, [slices, total, gapAngle]);

  if (total <= 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={(outer + inner) / 2} stroke={theme.colors.track} strokeWidth={thickness} fill="none" />
        </Svg>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {segments.map(({ slice, start, end }) => {
          const dimmed = selectedId != null && selectedId !== slice.id;
          return (
            <Path
              key={slice.id}
              d={ringSegment(cx, cy, outer, inner, start, end)}
              fill={slice.color}
              opacity={dimmed ? 0.25 : 1}
              onPress={onSelect ? () => onSelect(selectedId === slice.id ? null : slice.id) : undefined}
            />
          );
        })}
        {centerValue ? (
          <SvgText
            x={cx}
            y={cy + (centerLabel ? 0 : 6)}
            fontSize={centerValue.length > 10 ? 15 : 19}
            fontWeight="700"
            fill={theme.colors.text}
            textAnchor="middle"
          >
            {centerValue}
          </SvgText>
        ) : null}
        {centerLabel ? (
          <SvgText x={cx} y={cy + 18} fontSize={11} fill={theme.colors.textMuted} textAnchor="middle">
            {centerLabel}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

export type RankedRow = { id: string; label: string; icon?: string; value: number; color: string; caption?: string };

/**
 * Ranked horizontal bars. This is the readable companion to the donut: it
 * carries the exact figures, which also satisfies the "labels or table view"
 * relief for any hue with low contrast against the surface.
 */
export function RankedBars({
  rows,
  formatValue,
  onPressRow,
}: {
  rows: RankedRow[];
  formatValue: (value: number) => string;
  onPressRow?: (id: string) => void;
}) {
  const theme = useTheme();
  const max = rows.reduce((acc, r) => Math.max(acc, r.value), 0);
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((row) => (
        <Pressable
          key={row.id}
          onPress={onPressRow ? () => onPressRow(row.id) : undefined}
          style={({ pressed }) => ({ opacity: pressed && onPressRow ? 0.7 : 1, gap: 6 })}
        >
          <Row justify="space-between">
            <Row gap={spacing.sm} style={{ flex: 1 }}>
              {row.icon ? <Txt>{row.icon}</Txt> : null}
              <Txt variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
                {row.label}
              </Txt>
            </Row>
            <Txt variant="label">{formatValue(row.value)}</Txt>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.track, overflow: 'hidden' }}>
            <View
              style={{
                width: `${max > 0 ? (row.value / max) * 100 : 0}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: row.color,
              }}
            />
          </View>
          {row.caption ? (
            <Txt variant="caption" tone="faint">
              {row.caption}
            </Txt>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

export type BarGroup = { label: string; values: number[] };

/**
 * Grouped columns for two series on one shared value axis. Two measures of the
 * same unit belong on one axis — a second y-scale would let any pair of bars be
 * made to say anything.
 */
export function GroupedBarChart({
  groups,
  seriesColors,
  seriesLabels,
  formatValue,
  height = 180,
}: {
  groups: BarGroup[];
  seriesColors: string[];
  seriesLabels: string[];
  formatValue: (value: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const padTop = 18;
  const padBottom = 22;
  const plotHeight = height - padTop - padBottom;
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const groupWidth = width > 0 ? width / Math.max(1, groups.length) : 0;
  const barWidth = groupWidth > 0 ? Math.min(18, (groupWidth - GAP_PX * 2 - 10) / seriesColors.length) : 0;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {/* Recessive baseline and a single midpoint rule — no dashes. */}
          {[0, 0.5, 1].map((fraction) => (
            <Line
              key={fraction}
              x1={0}
              x2={width}
              y1={padTop + plotHeight * fraction}
              y2={padTop + plotHeight * fraction}
              stroke={theme.colors.border}
              strokeWidth={fraction === 1 ? 1 : 0.5}
            />
          ))}
          {groups.map((group, groupIndex) => {
            const groupX = groupIndex * groupWidth;
            const isSelected = selected === groupIndex;
            return (
              <G key={group.label}>
                <Rect
                  x={groupX}
                  y={0}
                  width={groupWidth}
                  height={height}
                  fill="transparent"
                  onPress={() => setSelected(isSelected ? null : groupIndex)}
                />
                {group.values.map((value, seriesIndex) => {
                  const barHeight = Math.max(value > 0 ? 2 : 0, (value / max) * plotHeight);
                  const totalBarsWidth = barWidth * group.values.length + GAP_PX * (group.values.length - 1);
                  const x = groupX + (groupWidth - totalBarsWidth) / 2 + seriesIndex * (barWidth + GAP_PX);
                  return (
                    <Rect
                      key={seriesIndex}
                      x={x}
                      y={padTop + plotHeight - barHeight}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill={seriesColors[seriesIndex]}
                      opacity={selected === null || isSelected ? 1 : 0.35}
                    />
                  );
                })}
                <SvgText
                  x={groupX + groupWidth / 2}
                  y={height - 6}
                  fontSize={10}
                  fill={isSelected ? theme.colors.text : theme.colors.textFaint}
                  textAnchor="middle"
                >
                  {group.label}
                </SvgText>
                {isSelected ? (
                  <SvgText
                    x={groupX + groupWidth / 2}
                    y={12}
                    fontSize={11}
                    fontWeight="600"
                    fill={theme.colors.text}
                    textAnchor="middle"
                  >
                    {group.values.map(formatValue).join('  ·  ')}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <Legend labels={seriesLabels} colors={seriesColors} />
    </View>
  );
}

/** Identity is never colour alone: every multi-series chart ships this. */
export function Legend({ labels, colors }: { labels: string[]; colors: string[] }) {
  return (
    <Row gap={spacing.lg} style={{ marginTop: spacing.sm, flexWrap: 'wrap' }}>
      {labels.map((label, index) => (
        <Row key={label} gap={6}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors[index] }} />
          <Txt variant="caption" tone="muted">
            {label}
          </Txt>
        </Row>
      ))}
    </Row>
  );
}

export type LinePoint = { label: string; value: number };

/** Single-series trend: a 2px line over a soft fill, with an end marker. */
export function AreaLineChart({
  points,
  color,
  formatValue,
  height = 160,
}: {
  points: LinePoint[];
  color?: string;
  formatValue: (value: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? theme.colors.primary;

  const padTop = 14;
  const padBottom = 20;
  const plotHeight = height - padTop - padBottom;

  const values = points.map((p) => p.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;

  const coords = points.map((point, index) => ({
    x: points.length > 1 ? (index / (points.length - 1)) * width : width / 2,
    y: padTop + plotHeight - ((point.value - min) / span) * plotHeight,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${padTop + plotHeight} L ${coords[0].x} ${padTop + plotHeight} Z`
      : '';
  const zeroY = padTop + plotHeight - ((0 - min) / span) * plotHeight;
  const last = coords[coords.length - 1];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && points.length > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke={theme.colors.border} strokeWidth={1} />
          {points.length > 1 ? <Path d={areaPath} fill={stroke} opacity={0.12} /> : null}
          {points.length > 1 ? <Path d={linePath} stroke={stroke} strokeWidth={2} fill="none" /> : null}
          {last ? <Circle cx={last.x} cy={last.y} r={4} fill={stroke} stroke={theme.colors.surface} strokeWidth={2} /> : null}
          {last ? (
            <SvgText
              x={Math.min(width - 4, last.x)}
              y={Math.max(11, last.y - 10)}
              fontSize={11}
              fontWeight="600"
              fill={theme.colors.text}
              textAnchor="end"
            >
              {formatValue(points[points.length - 1].value)}
            </SvgText>
          ) : null}
          <SvgText x={0} y={height - 5} fontSize={10} fill={theme.colors.textFaint}>
            {points[0].label}
          </SvgText>
          {points.length > 1 ? (
            <SvgText x={width} y={height - 5} fontSize={10} fill={theme.colors.textFaint} textAnchor="end">
              {points[points.length - 1].label}
            </SvgText>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
