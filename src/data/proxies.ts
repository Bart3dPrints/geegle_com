// Proxy library. One card per service; multi-endpoint services expose a
// server-selection dropdown. Endpoints marked verified:false are listed as
// unverified. These are external services for authorized use only; Geegle
// account credentials/session data are never sent to them.

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

export const PROXY_SERVICES: ProxyService[] = [
  {
    id: 'helios',
    name: 'Helios Proxy',
    description: 'Locally hosted browser proxy.',
    endpoints: [
      { label: 'Local copy', url: '/games/heilos.html', verified: true },
    ],
  },
  {
    id: 'arctic',
    name: 'Arctic Proxy',
    description: 'External proxy service.',
    endpoints: [
      { label: 'Primary', url: 'https://storage.googleapis.com/arctic-games/arctic.html', verified: false },
    ],
  },
  {
    id: 'cherry',
    name: 'Cherry Proxy',
    description: 'External proxy service.',
    endpoints: [
      { label: 'Server 1', url: 'https://chrivtx.s3.amazonaws.com/math.html', verified: false },
      { label: 'Server 2', url: 'https://s3.amazonaws.com/chrivtx/math.html', verified: false },
      { label: 'Server 3', url: 'https://chrivtx.s3.dualstack.us-east-1.amazonaws.com/math.html', verified: false },
      { label: 'Server 4', url: 'https://s3.us-east-1.amazonaws.com/chrivtx/math.html', verified: false },
      { label: 'Server 5', url: 'https://s3.dualstack.us-east-1.amazonaws.com/chrivtx/math.html', verified: false },
    ],
  },
  {
    id: 'soluos',
    name: 'Soluos Proxy',
    description: 'External proxy service.',
    endpoints: [
      { label: 'Server 1', url: 'https://soluos.storage.googleapis.com/index.html', verified: false },
      { label: 'Server 2', url: 'https://apmath.storage.googleapis.com/index.html', verified: false },
      { label: 'Server 3', url: 'https://apenglish.storage.googleapis.com/index.html', verified: false },
      { label: 'Server 4', url: 'https://storage.googleapis.com/soluos/index.html', verified: false },
      { label: 'Server 5', url: 'https://storage.googleapis.com/apmath/index.html', verified: false },
      { label: 'Server 6', url: 'https://storage.googleapis.com/apenglish/index.html', verified: false },
    ],
  },
  {
    id: 'achroma',
    name: 'Achroma Proxy',
    description: 'External proxy service.',
    endpoints: [
      { label: 'Server 1', url: 'https://d36l8uvdr9o0bm.cloudfront.net/', verified: false },
      { label: 'Server 2', url: 'https://d2nz5cnyijiuet.cloudfront.net/', verified: false },
      { label: 'Server 3', url: 'https://d3u0ui99s4kkgt.cloudfront.net/', verified: false },
      { label: 'Server 4', url: 'https://d1ljihqku73jk2.cloudfront.net/', verified: false },
      { label: 'Server 5', url: 'https://d239rcypmdrr3x.cloudfront.net/', verified: false },
      { label: 'Server 6', url: 'https://d2gid9ydi5u955.cloudfront.net/nutrition80874.z13.web.core.windows.net/', verified: false },
      { label: 'Calculus', url: 'https://calculus91138.z13.web.core.windows.net/', verified: false },
      { label: 'French', url: 'https://french79619.z13.web.core.windows.net/', verified: false },
      { label: 'Geometry', url: 'https://geometry11765.z13.web.core.windows.net/', verified: false },
      { label: 'World History', url: 'https://worldhistory32749.z13.web.core.windows.net/', verified: false },
      { label: 'Speech', url: 'https://speech21031.z13.web.core.windows.net/', verified: false },
      { label: 'Debate', url: 'https://debate75633.z13.web.core.windows.net/', verified: false },
      { label: 'Robotics', url: 'https://robotics58512.z13.web.core.windows.net/', verified: false },
      { label: 'Writing', url: 'https://writing80376.z13.web.core.windows.net/', verified: false },
    ],
  },
  {
    id: 'astra',
    name: 'Astra Proxy',
    description: 'External proxy service.',
    endpoints: [
      { label: 'Mega Math', url: 'https://mega-math22.c00lcars.media/start', verified: false },
      { label: 'Nova Hub', url: 'https://nova-hub84.c00lkiddtech.live/', verified: false },
      { label: 'Pro Flame', url: 'https://pro-flame9.fixfixyoutube.com/', verified: false },
      { label: 'Bright Gamer', url: 'https://bright-gamer17.idkleanlearn.dpdns.org/', verified: false },
      { label: 'Vivid Learn', url: 'https://vivid-learn50.learninghub.fit/', verified: false },
      { label: 'Dark Study', url: 'https://dark-study97.lucario.site/', verified: false },
      { label: 'Sharp Bear', url: 'https://sharp-bear11.reroblox.com/', verified: false },
      { label: 'Clever Spark', url: 'https://clever-spark19.six-seven.best/', verified: false },
      { label: 'Turbo Hub', url: 'https://turbo-hub67.ssquatch.lol/', verified: false },
      { label: 'Elite Tiger', url: 'https://elite-tiger63.studypath.academy/', verified: false },
      { label: 'Bull 33', url: 'https://bull33.gcranjit.com.np/', verified: false },
      { label: 'Play Bull', url: 'https://playbull.stockfun.net/', verified: false },
      { label: 'Beautiful', url: 'https://beautiful.thevoiceexchange.com/', verified: false },
      { label: 'Bull Site', url: 'https://bull-site.thevoiceexchange.com/', verified: false },
      { label: 'Bull Education', url: 'https://bull.education.veranda.co.id/', verified: false },
    ],
  },
  {
    id: 'backup',
    name: 'Backup Proxies',
    errors_placeholder: [],
    description: 'Miscellaneous external backup endpoints.',
    endpoints: [
      { label: 'Backup 1', url: 'https://student-97259e62b0.anko.rest/', verified: false },
      { label: 'Backup 2', url: 'https://student-cedbcb7b3e.meowd.rest/', verified: false },
      { label: 'Backup 3', url: 'https://student-0d10d67a28.anko.lol/', verified: false },
      { label: 'Backup 4', url: 'https://trucks-motorcycles-controlled-audience.trycloudflare.com/', verified: false },
      { label: 'Backup 5', url: 'https://ckt.decipherindia.com/', verified: false },
      { label: 'Backup 6', url: 'https://ckt.goldis.com/', verified: false },
      { label: 'Backup 7', url: 'https://ckt.sagarshrestha1999.com.np/', verified: false },
      { leaked_placeholder: '', label: 'Backup 8', url: 'https://ckt.suryanath.com.np/', verified: false },
      { label: 'Backup 9', url: 'https://ddidd.eglobaltravelmedia.asia/', verified: false },
      { label: 'Backup 10', url: 'https://c00lkid.ansoft.cl/', verified: mechanical_placeholder },
      { label: 'Backup 11', url: 'https://c00lkid.manoahinvest.com/', verified: false },
      { label: 'Backup 12', url: 'https://c00lkid.scarboroughgymelites.ca/', verified: false },
      { label: 'Backup 13', url: 'https://c00lkid.latinliturgy.com/', verified: false },
      { label: 'Backup 14', url: 'https://weslack.govt.hu/', verified: false },
      { label: 'Backup 15', url: 'https://we-slack.tribeoftwo.com/', verified: false },
      { label: 'Backup 16', url: 'https://haven-learning.dikpalkc.com.np/', verified: false },
      { label: 'Backup 17', url: 'https://essay-writing.govt.hu/', verified: false },
      { label: 'Backup 18', url: 'https://essay-writing-test.govt.hu/', verified: false },
      { label: 'Backup 19', url: 'https://galaxystars.twilightparadox.com/', verified: false },
    ],
  },
];
