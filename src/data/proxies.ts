// Proxy library. One card per service; multi-endpoint services expose a
// server-selector. Labels are exactly Server 1..N for every provider.
// These are external services for authorized use only; Geegle account
// credentials, tokens and private data are never sent to them.

export interface ProxyEndpoint {
  label: string;
  url: string;
  verified: boolean;
}

export interface ProxyService {
  id: string;
  name: string;
  endpoints: ProxyEndpoint[];
}

const remote = (label: string, url: string): ProxyEndpoint => ({ label, url, verified: false });
const local = (label: string, url: string): ProxyEndpoint => ({ label, url, verified: true });

export const PROXY_SERVICES: ProxyService[] = [
  {
    id: 'helios',
    name: 'Helios Proxy',
    endpoints: [local('Server 1', '/games/heilos.html')],
  },
  {
    id: 'arctic',
    name: 'Arctic Proxy',
    endpoints: [remote('Server 1', 'https://storage.googleapis.com/arctic-games/arctic.html')],
  },
  {
    id: 'cherry',
    name: 'Cherry Proxy',
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
    endpoints: [
      remote('Server 1', 'https://d36l8uvdr9o0bm.cloudfront.net/'),
      remote('Server 2', 'https://d2nz5cnyijiuet.cloudfront.net/'),
      remote('Server 3', 'https://d3u0ui99s4kkgt.cloudfront.net/'),
      remote('Server 4', 'https://d1ljihqku73jk2.cloudfront.net/'),
      remote('Server 5', 'https://d239rcypmdrr3x.cloudfront.net/'),
      remote('Server 6', 'https://d2gid9ydi5u955.cloudfront.net/nutrition80874.z13.web.core.windows.net/'),
      remote('Server 7', 'https://calculus91138.z13.web.core.windows.net/'),
      remote('Server 8', 'https://french79619.z13.web.core.windows.net/'),
      remote('Server 9', 'https://geometry11765.z13.web.core.windows.net/'),
      remote('Server 10', 'https://worldhistory32749.z13.web.core.windows.net/'),
      remote('Server 11', 'https://speech21031.z13.web.core.windows.net/'),
      remote('Server 12', 'https://debate75633.z13.web.core.windows.net/'),
      remote('Server 13', 'https://robotics58512.z13.web.core.windows.net/'),
      remote('Server 14', 'https://writing80376.z13.web.core.windows.net/'),
    ],
  },
  {
    id: 'astra',
    name: 'Astra Proxy',
    endpoints: [
      remote('Server 1', 'https://mega-math22.c00lcars.media/start'),
      remote('Server 2', 'https://nova-hub84.c00lkiddtech.live/'),
      remote('Server 3', 'https://pro-flame9.fixfixyoutube.com/'),
      remote('Server 4', 'https://bright-gamer17.idkleanlearn.dpdns.org/'),
      remote('Server 5', 'https://vivid-learn50.learninghub.fit/'),
      remote('Server 6', 'https://dark-study97.lucario.site/'),
      remote('Server 7', 'https://sharp-bear11.reroblox.com/'),
      remote('Server 8', 'https://clever-spark19.six-seven.best/'),
      remote('Server 9', 'https://turbo-hub67.ssquatch.lol/'),
      remote('Server 10', 'https://elite-tiger63.studypath.academy/'),
      remote('Server 11', 'https://bull33.gcranjit.com.np/'),
      remote('Server 12', 'https://playbull.stockfun.net/'),
      remote('Server 13', 'https://beautiful.thevoiceexchange.com/'),
      remote('Server 14', 'https://bull-site.thevoiceexchange.com/'),
      remote('Server 15', 'https://bull.education.veranda.co.id/'),
    ],
  },
  {
    id: 'backup',
    name: 'Backup Proxies',
    endpoints: [
      remote('Server 1', 'https://student-97259e62b0.anko.rest/'),
      remote('Server 2', 'https://student-cedbcb7b3e.meowd.rest/'),
      remote('Server 3', 'https://student-0d10d67a28.anko.lol/'),
      remote('Server 4', 'https://trucks-motorcycles-controlled-audience.trycloudflare.com/'),
      remote('Server 5', 'https://ckt.decipherindia.com/'),
      remote('Server 6', 'https://ckt.goldis.com/'),
      remote('Server 7', 'https://ckt.sagarshrestha1999.com.np/'),
      remote('Server 8', 'https://ckt.suryanath.com.np/'),
      remote('Server 9', 'https://ddidd.eglobaltravelmedia.asia/'),
      remote('Server 10', 'https://c00lkid.ansoft.cl/'),
      remote('Server 11', 'https://c00lkid.manoahinvest.com/'),
      remote('Server 12', 'https://c00lkid.scarboroughgymelites.ca/'),
      remote('Server 13', 'https://c00lkid.latinliturgy.com/'),
      remote('Server 14', 'https://weslack.govt.hu/'),
      remote('Server 15', 'https://we-slack.tribeoftwo.com/'),
      remote('Server 16', 'https://haven-learning.dikpalkc.com.np/'),
      remote('Server 17', 'https://essay-writing.govt.hu/'),
      remote('Server 18', 'https://essay-writing-test.govt.hu/'),
      remote('Server 19', 'https://galaxystars.twilightparadox.com/'),
    ],
  },
];

export function proxyUrl(service: ProxyService, endpointIndex: number): string {
  const ep = service.endpoints[endpointIndex] ?? service.endpoints[0];
  return ep?.url ?? '';
}
