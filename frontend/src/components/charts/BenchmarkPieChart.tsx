import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chartColors } from '../../lib/chartTheme';
import type { Goal } from '../../types/extraction';

interface BenchmarkPieChartProps {
  goals: Goal[];
  height: number;
}

function bucketStatus(status: string): 'met' | 'notStarted' | 'inProgress' | 'other' {
  if (status === 'met') return 'met';
  if (status === 'not-started') return 'notStarted';
  if (status === 'in-progress') return 'inProgress';
  return 'other';
}

export default function BenchmarkPieChart({ goals, height }: BenchmarkPieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const counts = useMemo(() => {
    const all = goals.flatMap(g => g.benchmarks);
    let met = 0;
    let notStarted = 0;
    let inProgress = 0;
    let other = 0;
    for (const b of all) {
      const k = bucketStatus(b.status);
      if (k === 'met') met++;
      else if (k === 'notStarted') notStarted++;
      else if (k === 'inProgress') inProgress++;
      else other++;
    }
    return { met, notStarted, inProgress, other, total: all.length };
  }, [goals]);

  useEffect(() => {
    if (!svgRef.current || counts.total === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = Math.min(width, height) / 2 - 10;
    const cx = width / 2;
    const cy = height / 2;

    type Datum = { label: string; value: number; color: string };
    const data: Datum[] = [
      { label: 'Met', value: counts.met, color: chartColors.benchmarkMet },
      { label: 'Not started', value: counts.notStarted, color: chartColors.benchmarkNotStarted },
      { label: 'In progress', value: counts.inProgress, color: chartColors.benchmarkInProgress },
      { label: 'Other', value: counts.other, color: chartColors.benchmarkOther },
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
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 min-h-[2.5rem] items-center text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.benchmarkMet }} />
          Met ({counts.met})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.benchmarkNotStarted }} />
          Not started ({counts.notStarted})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.benchmarkInProgress }} />
          In progress ({counts.inProgress})
        </span>
        {counts.other > 0 ? (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.benchmarkOther }} />
            Other ({counts.other})
          </span>
        ) : null}
      </div>
    </div>
  );
}
