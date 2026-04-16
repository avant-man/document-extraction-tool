import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAcresProgress } from '../../lib/chartFormat';
import { chartColors, targetBarOpacity } from '../../lib/chartTheme';
import type { BMP } from '../../types/extraction';

const DISPLAY_MAX = 32;

interface Row {
  displayName: string;
  fullName: string;
  target: number;
  achieved: number;
}

interface ImplementationBarChartProps {
  bmps: BMP[];
  height: number;
}

function truncateName(name: string): string {
  if (name.length <= DISPLAY_MAX) return name;
  return name.slice(0, DISPLAY_MAX - 3) + '...';
}

/** Space for y-axis labels; scales down in narrow containers so the bar track stays usable. */
function marginLeftForWidth(containerWidth: number): number {
  return Math.min(200, Math.max(120, Math.round(containerWidth * 0.35)));
}

/** Reserve right margin for `formatAcresProgress` text; ticks scale with inner width. */
export function xAxisTickCount(innerWidth: number): number {
  return Math.max(2, Math.min(6, Math.floor(innerWidth / 72)));
}

export default function ImplementationBarChart({ bmps, height }: ImplementationBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const chartData = useMemo((): Row[] => {
    return bmps
      .filter(b => b.targetAcres !== null)
      .sort((a, b) =>
        (b.targetAcres! - (b.implementedAcres ?? 0)) - (a.targetAcres! - (a.implementedAcres ?? 0))
      )
      .slice(0, 15)
      .map(b => ({
        fullName: b.name,
        displayName: truncateName(b.name),
        target: b.targetAcres!,
        achieved: b.implementedAcres ?? 0,
      }));
  }, [bmps]);

  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const marginRight = 118;
    const marginLeft = marginLeftForWidth(width);
    const margin = { top: 10, right: marginRight, bottom: 34, left: marginLeft };
    const innerWidth = Math.max(48, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;
    const tickCount = xAxisTickCount(innerWidth);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3.scaleBand()
      .domain(chartData.map(d => d.displayName))
      .range([0, innerHeight])
      .padding(0.3);

    const maxTarget = d3.max(chartData, d => d.target) ?? 1;
    const xScale = d3.scaleLinear()
      .domain([0, maxTarget * 1.1])
      .range([0, innerWidth]);

    g.selectAll('.bar-target')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-target')
      .attr('x', 0)
      .attr('y', d => yScale(d.displayName) ?? 0)
      .attr('width', d => xScale(d.target))
      .attr('height', yScale.bandwidth())
      .attr('fill', chartColors.target)
      .attr('opacity', targetBarOpacity);

    g.selectAll('.bar-achieved')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-achieved')
      .attr('x', 0)
      .attr('y', d => yScale(d.displayName) ?? 0)
      .attr('width', d => xScale(d.achieved))
      .attr('height', yScale.bandwidth())
      .attr('fill', chartColors.achieved);

    g.selectAll('.label-progress')
      .data(chartData)
      .join('text')
      .attr('class', 'label-progress')
      .attr('x', innerWidth + 6)
      .attr('y', d => (yScale(d.displayName) ?? 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(d => formatAcresProgress(d.achieved, d.target));

    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0).tickPadding(8));
    yAxis.select('.domain').remove();
    yAxis.selectAll<SVGGElement, string>('.tick').each(function (d) {
      const row = chartData.find(r => r.displayName === d);
      d3.select(this).append('title').text(row?.fullName ?? d);
    });

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(tickCount)
          .tickFormat(d => d3.format('~s')(+d))
      );

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 28)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text('Acres');

  }, [chartData, width, height]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="overflow-visible max-w-full" width={width} height={height} />
      <div className="flex gap-4 justify-end mt-1 min-h-[1.75rem] items-center text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm opacity-30"
            style={{ backgroundColor: chartColors.target }}
          />
          Target
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.achieved }} />
          Achieved
        </span>
      </div>
    </div>
  );
}
