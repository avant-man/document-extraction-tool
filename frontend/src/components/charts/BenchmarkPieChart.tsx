import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Goal } from '../../types/extraction';

interface BenchmarkPieChartProps {
  goals: Goal[];
  height: number;
}

export default function BenchmarkPieChart({ goals, height }: BenchmarkPieChartProps) {
  // responsive width
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // aggregate benchmark counts — memoized
  const counts = useMemo(() => {
    const all = goals.flatMap(g => g.benchmarks);
    return {
      met: all.filter(b => b.status === 'met').length,
      not_met: all.filter(b => b.status === 'not_met').length,
      in_progress: all.filter(b => b.status === 'in_progress').length,
      total: all.length,
    };
  }, [goals]);

  // D3 donut rendering
  useEffect(() => {
    if (!svgRef.current || counts.total === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // clear first — prevents StrictMode doubles

    const radius = Math.min(width, height) / 2 - 10;
    const cx = width / 2;
    const cy = height / 2;

    type Datum = { label: string; value: number; color: string };
    const data: Datum[] = [
      { label: 'Met', value: counts.met, color: '#16a34a' },
      { label: 'Not Met', value: counts.not_met, color: '#ef4444' },
      { label: 'In Progress', value: counts.in_progress, color: '#f59e0b' },
    ].filter(d => d.value > 0);

    const pie = d3.pie<Datum>().value(d => d.value).sort(null);
    const arc = d3.arc<d3.PieArcDatum<Datum>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius * 0.9);

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    g.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Center text: total count
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.1em')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('fill', '#111827')
      .text(counts.total);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.4em')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text('Benchmarks');

  }, [counts, width, height]);

  // empty state
  if (counts.total === 0) {
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
      <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#16a34a' }} />
          Met ({counts.met})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
          Not Met ({counts.not_met})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
          In Progress ({counts.in_progress})
        </span>
      </div>
    </div>
  );
}
