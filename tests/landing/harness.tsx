import { createRoot } from 'react-dom/client';
import { SearchLanding } from '../../src/components/SearchLanding';
import '../../src/index.css';

const params = new URLSearchParams(location.search);
const id = params.get('account');
createRoot(document.getElementById('root')!).render(<SearchLanding
  onOpenLibrary={() => { document.body.dataset.destination = 'guard'; }}
  onSearch={({ query, mode }) => { document.body.dataset.search = JSON.stringify([query, mode]); }}
  account={id ? {
    id, appearance: JSON.parse(sessionStorage.getItem('fixture:' + id) ?? 'null'),
    saveAppearance: async (value) => {
      if (params.has('fail')) throw new Error('Simulated failure');
      sessionStorage.setItem('fixture:' + id, JSON.stringify(value));
    }
  } : undefined}
/>);
