/**
 * FIO: 50 TCP/HTTP local connections against the real Express application.
 * All 50 target GET /api/health (no database, authentication or payments).
 * Per-IP health limiter is 30/min, so exactly 30 OK + 20 RATE_LIMIT is expected.
 * Does NOT validate 50 concurrent booking operations or remote DB throughput.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { createApp } from '../server/app.ts';

const PORT_HOST = '127.0.0.1';
const N = 50;
const app = createApp(async () => {
  throw new Error('O teste nao deve chamar autenticacao');
});
const server = app.listen(0, PORT_HOST);
let connections = 0;
server.on('connection', () => { connections += 1; });

function requestHealth(port) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const request = http.request({
      hostname: PORT_HOST,
      port,
      path: '/api/health',
      method: 'GET',
      agent: false, // a new TCP socket for each request
      timeout: 12_000,
      headers: { 'Cache-Control': 'no-store' }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch (e) { reject(new Error(`JSON invalido na resposta HTTP ${response.statusCode}: ${e.message}`)); return; }
        resolve({
          status: response.statusCode,
          requestId: String(response.headers['x-request-id'] || ''),
          retryAfter: response.headers['retry-after'],
          body,
          elapsedMs: performance.now() - t0
        });
      });
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('timeout de 12 segundos')));
    request.end();
  });
}

try {
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  console.log(`OK: API FIO Express iniciada SOMENTE no loopback, porta temporaria ${address.port}.`);

  const t0 = performance.now();
  const results = await Promise.all(Array.from({length:N}, () => requestHealth(address.port)));
  const elapsed = Math.round(performance.now() - t0);
  const statuses = new Map();
  for (const r of results) statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
  const sorted = [...results].map(x => x.elapsedMs).sort((a,b) => a-b);
  const p95 = Math.round(sorted[Math.ceil(N * 0.95) - 1]);

  console.log(`HTTP respostas: ${[...statuses].map(([k,v])=>`${k}=${v}`).join(' | ')}`);
  console.log(`Sockets TCP criados: ${connections}`);
  console.log(`Duracao do lote: ${elapsed} ms | p95 HTTP: ${p95} ms (localhost)`);

  assert.equal(results.length, 50, 'Nao chegaram todas as 50 respostas');
  assert.equal(connections, 50, 'Nem todas as requisicoes criaram seu proprio socket TCP');
  assert.equal(statuses.get(200) ?? 0, 30, 'O limite da rota /api/health deveria aceitar 30/min por IP');
  assert.equal(statuses.get(429) ?? 0, 20, 'O limite da rota /api/health deveria bloquear 20 excedentes');
  assert.equal(statuses.size, 2, 'Respostas HTTP inesperadas (ex.: 500)');
  assert.equal(new Set(results.map(r=>r.requestId)).size, 50, 'Os IDs de requisicao nao sao unicos');
  for (const r of results) {
    assert.ok(r.requestId.length >= 12, 'X-Request-Id ausente');
    if (r.status === 200) assert.equal(r.body.status, 'ok');
    else {
      assert.equal(r.body.code, 'RATE_LIMIT');
      assert.ok(Number(r.retryAfter)>0, 'Retry-After ausente no 429');
    }
  }

  console.log('OK: 50/50 conexoes HTTP respondidas corretamente.');
  console.log('OK: limite de 30/min bloqueou excedentes com HTTP 429 e Retry-After.');
  console.log('OK: sem erros HTTP 500, sem consultas de banco e sem transacoes financeiras.');
  console.log('FIO MVP - SMOKE HTTP 50: APROVADO.');
  console.log('NOTA: isto NAO equivale a 50 agendamentos concorrentes em PostgreSQL remoto.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve=>server.close(()=>resolve()));
}