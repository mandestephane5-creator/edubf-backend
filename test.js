import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 50,        // 50 utilisateurs virtuels simultanés
  duration: '10s', // pendant 10 secondes
};

export default function () {
  http.get('https://edubf-backend-production.up.railway.app/api/health');
  sleep(1);
}