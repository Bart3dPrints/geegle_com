// Proxy card: service name, server dropdown, launch button, verified badge.

import { Globe, Star } from 'lucide-react';
import type { ProxyService } from '../data/proxies';

export function ProxyCard({
  service,
  selected,
  onSelect,
  onLaunch,
}: {
  service: ProxyService;
  selected: number;
  onSelect: (index: number) => void;
  onLaunch: (index: number) => void;
}) {
  const endpoint = service.endpoints[selected] ?? service.endpoints[0];
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Globe size={16} className="text-slate-400" />
        <h3 className="text-sm font-semibold">{service.name}</h3>
        {endpoint && !endpoint.verified && (
          <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Unverified
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {service.description}
      </p>
      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={selected}
          onChange={(e) => onSelect(Number(e.target.value))}
          aria-label={`Server for ${service.name}`}
        >
          {service.endpoints.map((ep, i) => (
            <option key={ep.url} value={i}>
              {ep.label}
              {ep.verified ? '' : ' (unverified)'}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={() => onLaunch(selected)}>
          Open
        </button>
      </div>
      <button
        className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        onClick={() => onSelect(selected)}
        aria-label={`${service.name} is the selected default`}
      >
        <Star size={12} className="fill-current" />
        Default server — saved automatically
      </button>
    </div>
  );
}
