// Proxy card: provider screenshot (when the owner supplied one), provider name,
// server selector and Open. No descriptions or promotional text. Only the
// backup provider may show an Unverified badge.

import type { ProxyService } from '../data/proxies';
import { SERVICE_ARTWORK } from '../data/serviceArtwork';

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
  const artwork = SERVICE_ARTWORK[service.id];
  return (
    <div className="card p-4">
      {artwork && (
        <img
          src={artwork.url}
          alt={artwork.alt}
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
          className="mb-3 aspect-video w-full rounded-lg border border-neutral-200 object-cover dark:border-neutral-800"
        />
      )}
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{service.name}</h3>
        {service.id === 'backup' && endpoint && !endpoint.verified && (
          <span className="badge border border-neutral-300 text-neutral-600 dark:border-neutral-600 dark:text-neutral-300">
            Unverified
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={selected}
          onChange={(e) => onSelect(Number(e.target.value))}
          aria-label={`Server for ${service.name}`}
        >
          {service.endpoints.map((ep, i) => (
            <option key={ep.url} value={i} disabled={ep.available === false}>
              {ep.label}
            </option>
          ))}
        </select>
        <button
          className="btn-primary"
          onClick={() => onLaunch(selected)}
          disabled={endpoint?.available === false}
        >
          Open
        </button>
      </div>
      {endpoint?.available === false && (
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400" role="status">
          {endpoint.unavailableReason ?? 'This server is unavailable.'}
        </p>
      )}
    </div>
  );
}
