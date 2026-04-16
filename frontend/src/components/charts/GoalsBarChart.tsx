import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chartColors } from '../../lib/chartTheme';
import type { Goal } from '../../types/extraction';

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

    const margin = { top: 28, right: 24, bottom: 60, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.category))
      .range([0, innerWidth])
      .padding(0.2);

    const subScale = d3.scaleBand()
      .domain(['target', 'achieved'])
      .range([0, xScale.bandwidth()])
      .padding(0.05);

    const maxVal = Math.max(
      d3.max(chartData, d => d.target) ?? 0,
      d3.max(chartData, d => d.achieved) ?? 0,
      1
    );
    const yScale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([innerHeight, 0])
      .nice();

    const tickCount = Math.min(8, Math.max(2, maxVal + 1));

    // Target bars
    g.selectAll('.bar-target')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-target')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('target') ?? 0))
      .attr('y', d => yScale(d.target))
      .attr('width', subScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.target))
      .attr('fill', chartColors.target);

    // Achieved bars
    g.selectAll('.bar-achieved')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-achieved')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('achieved') ?? 0))
      .attr('y', d => yScale(d.achieved))
      .attr('width', subScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.achieved))
      .attr('fill', chartColors.achieved);

    const labelY = (v: number) => (v > 0 ? yScale(v) - 5 : innerHeight - 8);

    g.selectAll('.label-target')
      .data(chartData)
      .join('text')
      .attr('class', 'label-target')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('target') ?? 0) + subScale.bandwidth() / 2)
      .attr('y', d => labelY(d.target))
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(d => String(d.target));

    g.selectAll('.label-achieved')
      .data(chartData)
      .join('text')
      .attr('class', 'label-achieved')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('achieved') ?? 0) + subScale.bandwidth() / 2)
      .attr('y', d => labelY(d.achieved))
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(d => String(d.achieved));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.1em');

    g.append('g').call(
      d3.axisLeft(yScale).ticks(tickCount).tickFormat(d3.format('d'))
    );

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 14)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
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
