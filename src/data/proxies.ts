// Proxy library. One card per service; multi-endpoint services expose a
// server-selection dropdown. Endpoints are unverified unless marked
// otherwise. These are external services for authorized use only — Geegle
// account credentials, tokens, and private data are never sent to them.

export interface ProxyEndpoint {
  label: string;
  url: string;
  verified: boolean;
}

export interface ProxyService {
  id: string;
  name: string;
  description: string;
  endpoints: ProxyEndpoint[];
}

const remote = (label: string, url: string): ProxyEndpoint => ({
  label,
  url,
  verified: false,
});

const local = (label: string, url: string): ProxyEndpoint => ({
  label,
  url,
  verified: true,
});

export const PROXY_SERVICES: ProxyService[] = [
  {
    id: 'helios',
    name: 'Helios Proxy',
    description: 'Locally hosted browser proxy.',
    endpoints: [local('Local copy', '/games/heilos.html')],
  },
  {
    id: 'arctic',
    name: 'Arctic Proxy',
    description: 'External proxy service.',
    endpoints: [remote('Primary', 'https://storage.googleapis.com/arctic-games/arctic.html')],
  },
  {
    id: 'cherry',
    name: 'Cherry Proxy',
    description: 'External proxy service with five mirrors.',
    endpoints: [
      remote('Server 1', 'https://chrivtx.s3.amazonaws.com/math.html'),
      remote('Server 2', 'https://s3.amazonaws.com/chrivtx/math.html'),
      remote('Server 3', 'https://chrivtx.s3.dualstack.us-east-1.amazonaws.com/math.html'),
      remote('Server 4', 'https://s3.us-east-1.amazonaws.com/chrivtx/math.html'),
      remote('Server 5', 'https://s3.dualstack.us-east-1.amazonaws.com/chrivtx/math.html'),
    ],
  },
  {
    id: 'soluos',
    name: 'Soluos Proxy',
    description: 'External proxy service with six mirrors.',
    endpoints: [
      remote('Server 1', 'https://soluos.storage.googleapis.com/index.html'),
      remote('Server 2', 'https://apmath.storage.googleapis.com/index.html'),
      remote('Server 3', 'https://apenglish.storage.googleapis.com/index.html'),
      remote('Server 4', 'https://storage.googleapis.com/soluos/index.html'),
      remote('Server 5', 'https://storage.googleapis.com/apmath/index.html'),
      remote('Server 6', 'https://storage.googleapis.com/apenglish/index.html'),
    ],
  },
  {
    id: 'achroma',
    name: 'Achroma Proxy',
    description: 'External proxy service with 14 mirrors.',
    endpoints: [
      remote('Server 1', 'https://d36l8uvdr9o0bm.cloudfront.net/'),
      remote('Server 2', 'https://d2nz5cnyijiuet.cloudfront.net/'),
      remote('Server 3', 'https://d3u0ui99s4kkgt.cloudfront.net/'),
      remote('Server 4', 'https://d1ljihqku73jk2.cloudfront.net/'),
      remote('Server 5', 'https://d239rcypmdrr3x.cloudfront.net/'),
      remote('Server 6', 'https://d2gid9ydi5u955.cloudfront.net/nutrition80874.z13.web.core.windows.net/'),
      remote('Calculus', 'https://calculus91138.z13.web.core.windows.net/'),
      remote('French', 'https://french79619.z13.web.core.windows.net/'),
      remote('Geometry', 'https://geometry11765.z13.web.core.windows.net/'),
      remote('World History', 'https://worldhistory32749.z13.web.core.windows.net/'),
      remote('Speech', 'https://speech21031.z13.web.core.windows.net/'),
      remote('Debate', 'https://debate75633.z13.web.core.windows.net/'),
      remote('Robotics', 'https://robotics58512.z13.web.core.windows.net/'),
      remote('Writing', 'https://writing80376.z13.web.core.windows.net/'),
    ],
  },
  {
    id: 'astra',
    name: 'Astra Proxy',
    description: 'External proxy service with 15 mirrors.',
    endpoints: [
      remote('Mega Math', 'https://mega-math22.c00lcars.media/start'),
      remote('Nova Hub', 'https://nova-hub84.c00lkiddtech.live/'),
      remote('Pro Flame', 'https://pro-flame9.fixfixyoutube.com/'),
      remote('Bright Gamer', 'https://bright-gamer17.idkleanlearn.dpdns.org/'),
      remote('Vivid Learn', 'https://vivid-learn50.learninghub.fit/'),
      remote('Dark Study', 'https://dark-study97.lucario.site/'),
      remote('Sharp Bear', 'https://sharp-bear11.reroblox.com/'),
      remote('Clever Spark', 'https://clever-spark19.six-seven.best/'),
      remote('Turbo Hub', 'https://turbo-hub67.ssquatch.lol/'),
      remote('Elite Tiger', 'https://elite-tiger63.studypath.academy/'),
      remote('Bull 33', 'https://bull33.gcranjit.com.np/'),
      remote('Play Bull', 'https://playbull.stockfun.net/'),
      remote('Beautiful', 'https://beautiful.thevoiceexchange.com/'),
      remote('Bull Site', 'https://bull-site.thevoiceexchange.com/'),
      remote('Bull Education', 'https://bull.education.veranda.co.id/'),
    ],
  },
  {
    id: 'backup',
    name: 'Backup Proxies',
    description: 'Miscellaneous external backup endpoints.',
    endpoints: [
      remote('Backup 1', 'https://student-97259e62b0.anko.rest/'),
      remote('Backup 2', 'https://student-cedbcb7b3e.meowd.rest/'),
      remote('Backup 3', 'https://student-0d10d67a28.anko.lol/'),
      remote('Backup 4', 'https://trucks-motorcycles-controlled-audience.trycloudflare.com/'),
      remote('Backup 5', 'https://ckt.decipherindia.com/'),
      remote('Backup 6', 'https://ckt.goldis.com/'),
      remote('Backup 7', 'https://ckt.sagarshrestha1999.com.np/'),
      remote('Backup 8', 'https://ckt.suryanath.com.np/'),
      remote('Backup 9', 'https://ddidd.eglobaltravelmedia.asia/'),
      remote('Backup 10', 'https://c00lkid.ansoft.cl/'),
      remote('Backup 11', 'https://c00lkid.manoahinvest.com/'),
      remote('Backup 12', 'https://c00lkid.scarboroughgymelites.ca/'),
      remote('Backup 13', 'https://c00lkid.latinliturgy.com/'),
      remote('Backup 14', 'https://weslack.govt.hu/'),
      remote('Backup 15', 'https://we-slack.tribeoftwo.com/'),
      remote('Backup 16', 'https://haven-learning.dikpalkc.com.np/'),
      remote('Backup 17', 'https://essay-writing.govt.hu/'),
      remote('Backup 18', 'https://essay-writing-test.govt.hu/'),
      remote('Backup 19', 'https://galaxystars.twilightparadox.com/'),
    ],
  },
];

export function proxyUrl(service: ProxyService, endpointIndex: number): string {
  const ep = service.endpoints[endpointIndex] ?? service.endpoints[0];
  return ep?.url ?? '';
}
