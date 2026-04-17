import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { axisMuted, chartColors } from '../../lib/chartTheme';
import type { Goal } from '../../types/extraction';

const GRID_STROKE = '#e5e7eb';
const AXIS_STROKE = '#d1d5db';
const BAR_RX = 4;

/** Integer tick positions for count data — avoids duplicate labels from fractional ticks. */
function yTickValues(maxCount: number): number[] {
  const hi = Math.max(1, Math.ceil(maxCount));
  if (hi <= 12) return d3.range(0, hi + 1);
  const step = Math.ceil(hi / 8);
  const out: number[] = [];
  for (let v = 0; v < hi; v += step) out.push(v);
  if (out[out.length - 1] !== hi) out.push(hi);
  return out;
}

interface GoalsBarChartProps {
  goals: Goal[];
  height: number;
}

export default function GoalsBarChart({ goals, height }: GoalsBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const chartData = useMemo(() => {
    const bucket = (g: Goal) => (g.pollutants?.[0]?.trim() ? g.pollutants[0] : 'General');
    const categories = Array.from(new Set(goals.map(bucket)));
    return categories.map(cat => {
      const catGoals = goals.filter(g => bucket(g) === cat);
      return {
        category: cat,
        target: catGoals.length,
        achieved: catGoals.filter(g =>
          g.benchmarks.length > 0 && g.benchmarks.every(b => b.status === 'met')
        ).length,
      };
    });
  }, [goals]);

  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const maxLabelLen = Math.max(...chartData.map(d => d.category.length), 4);
    const rotateX = maxLabelLen > 14;
    const margin = { top: 28, right: 24, bottom: rotateX ? 56 : 40, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.category))
      .range([0, innerWidth])
      .padding(0.22);

    const subScale = d3.scaleBand()
      .domain(['target', 'achieved'])
      .range([0, xScale.bandwidth()])
      .padding(0.12);

    const maxVal = Math.max(
      d3.max(chartData, d => d.target) ?? 0,
      d3.max(chartData, d => d.achieved) ?? 0,
      1
    );
    const yHi = Math.max(1, Math.ceil(maxVal));
    const yScale = d3.scaleLinear()
      .domain([0, yHi])
      .range([innerHeight, 0]);

    const ticks = yTickValues(maxVal);

    // Horizontal grid (behind bars)
    g.append('g')
      .attr('class', 'grid-y')
      .call(
        d3.axisLeft(yScale)
          .tickValues(ticks)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', GRID_STROKE)
      .attr('stroke-dasharray', '4 4');

    // Target bars
    g.selectAll('.bar-target')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-target')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('target') ?? 0))
      .attr('y', d => yScale(d.target))
      .attr('width', subScale.bandwidth())
      .attr('height', d => Math.max(0, innerHeight - yScale(d.target)))
      .attr('rx', BAR_RX)
      .attr('ry', BAR_RX)
      .attr('fill', chartColors.target);

    // Achieved bars
    g.selectAll('.bar-achieved')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-achieved')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('achieved') ?? 0))
      .attr('y', d => yScale(d.achieved))
      .attr('width', subScale.bandwidth())
      .attr('height', d => Math.max(0, innerHeight - yScale(d.achieved)))
      .attr('rx', BAR_RX)
      .attr('ry', BAR_RX)
      .attr('fill', chartColors.achieved);

    const labelY = (v: number) => (v > 0 ? yScale(v) - 6 : innerHeight);

    g.selectAll('.label-target')
      .data(chartData.filter(d => d.target > 0))
      .join('text')
      .attr('class', 'label-target')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('target') ?? 0) + subScale.bandwidth() / 2)
      .attr('y', d => labelY(d.target))
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', '#1f2937')
      .text(d => String(d.target));

    g.selectAll('.label-achieved')
      .data(chartData.filter(d => d.achieved > 0))
      .join('text')
      .attr('class', 'label-achieved')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('achieved') ?? 0) + subScale.bandwidth() / 2)
      .attr('y', d => labelY(d.achieved))
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', '#1f2937')
      .text(d => String(d.achieved));

    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSizeOuter(0));

    xAxis.selectAll('text')
      .style('font-size', '12px')
      .style('fill', axisMuted)
      .attr('transform', rotateX ? 'rotate(-40)' : null)
      .style('text-anchor', rotateX ? 'end' : 'middle')
      .attr('dx', rotateX ? '-0.4em' : '0')
      .attr('dy', rotateX ? '0.15em' : '0.85em');

    xAxis.select('.domain').attr('stroke', AXIS_STROKE);

    const yAxis = g.append('g').call(
      d3.axisLeft(yScale)
        .tickValues(ticks)
        .tickFormat(d3.format('d'))
        .tickSizeOuter(0)
    );
    yAxis.selectAll('text')
      .style('font-size', '12px')
      .style('fill', axisMuted);
    yAxis.select('.domain').attr('stroke', AXIS_STROKE);
    yAxis.selectAll('.tick line').attr('stroke', AXIS_STROKE);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 14)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', axisMuted)
      .text('Number of Goals');

  }, [chartData, width, height]);

  if (goals.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} width={width} height={height} />
      <div className="flex gap-4 justify-end mt-1 min-h-[1.75rem] items-center text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.target }} />
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
