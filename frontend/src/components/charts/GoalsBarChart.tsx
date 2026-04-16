import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    const categories = Array.from(new Set(goals.map(g => g.category)));
    return categories.map(cat => {
      const catGoals = goals.filter(g => g.category === cat);
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

    const margin = { top: 20, right: 30, bottom: 60, left: 40 };
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

    const maxVal = d3.max(chartData, d => d.target) ?? 1;
    const yScale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([innerHeight, 0])
      .nice();

    // Target bars (teal)
    g.selectAll('.bar-target')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-target')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('target') ?? 0))
      .attr('y', d => yScale(d.target))
      .attr('width', subScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.target))
      .attr('fill', '#0d9488');

    // Achieved bars (green)
    g.selectAll('.bar-achieved')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-achieved')
      .attr('x', d => (xScale(d.category) ?? 0) + (subScale('achieved') ?? 0))
      .attr('y', d => yScale(d.achieved))
      .attr('width', subScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.achieved))
      .attr('fill', '#16a34a');

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.1em');

    // Y axis
    g.append('g').call(d3.axisLeft(yScale).ticks(maxVal).tickFormat(d3.format('d')));

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 5)
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
      {/* Legend */}
      <div className="flex gap-4 justify-end mt-1 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#0d9488' }} />
          Target
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#16a34a' }} />
          Achieved
        </span>
      </div>
    </div>
  );
}
