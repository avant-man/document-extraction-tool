import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BMP } from '../../types/extraction';

interface ImplementationBarChartProps {
  bmps: BMP[];
  height: number;
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

  // Prepare data: filter nulls, sort by gap desc, slice top 15, truncate names
  const chartData = useMemo(() => {
    return bmps
      .filter(b => b.targetAcres !== null)
      .sort((a, b) =>
        ((b.targetAcres! - (b.achievedAcres ?? 0)) - (a.targetAcres! - (a.achievedAcres ?? 0)))
      )
      .slice(0, 15)
      .map(b => ({
        name: b.name.length > 25 ? b.name.slice(0, 22) + '...' : b.name,
        target: b.targetAcres!,
        achieved: b.achievedAcres ?? 0,
      }));
  }, [bmps]);

  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // clear first — prevents StrictMode doubles

    const margin = { top: 10, right: 70, bottom: 30, left: 160 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3.scaleBand()
      .domain(chartData.map(d => d.name))
      .range([0, innerHeight])
      .padding(0.3);

    const maxTarget = d3.max(chartData, d => d.target) ?? 1;
    const xScale = d3.scaleLinear()
      .domain([0, maxTarget * 1.1])
      .range([0, innerWidth]);

    // Target bars (teal, semi-transparent background)
    g.selectAll('.bar-target')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-target')
      .attr('x', 0)
      .attr('y', d => yScale(d.name) ?? 0)
      .attr('width', d => xScale(d.target))
      .attr('height', yScale.bandwidth())
      .attr('fill', '#0d9488')
      .attr('opacity', 0.3);

    // Achieved bars (green, solid, overlaid)
    g.selectAll('.bar-achieved')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar-achieved')
      .attr('x', 0)
      .attr('y', d => yScale(d.name) ?? 0)
      .attr('width', d => xScale(d.achieved))
      .attr('height', yScale.bandwidth())
      .attr('fill', '#16a34a');

    // Value labels at end of achieved bar
    g.selectAll('.label-achieved')
      .data(chartData)
      .join('text')
      .attr('class', 'label-achieved')
      .attr('x', d => xScale(d.achieved) + 4)
      .attr('y', d => (yScale(d.name) ?? 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(d => d.achieved.toLocaleString());

    // Y axis (BMP names)
    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0).tickPadding(8))
      .select('.domain').remove();

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => d3.format('~s')(+d)));

    // X axis label
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
      <svg ref={svgRef} width={width} height={height} />
      {/* Legend */}
      <div className="flex gap-4 justify-end mt-1 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm opacity-30" style={{ backgroundColor: '#0d9488' }} />
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
