import assert from 'assert';
import { fetchEvenDealsQuote } from './evenDeals';

function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
    })
    .catch(err => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

/** Stubs fetch with Evendeals answers and counts the calls per IP. */
function stubEvenDeals(respond: (ip: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const ip = new URL(String(input)).searchParams.get('ip') ?? '';
    calls.push(ip);
    return respond(ip);
  }) as typeof fetch;
  return calls;
}

function discountResponse(percent: number): Response {
  return new Response(JSON.stringify({
    isVpn: false,
    discount: { discountAmount: String(percent), countryCode: 'IN', couponCode: 'SAVE' },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function main() {
  const originalFetch = globalThis.fetch;
  process.env.EVENDEALS_API_KEY = 'test-key';
  process.env.EVENDEALS_PRODUCT_ID = 'product-1';

  try {
    await run('concurrent and repeat lookups for one visitor share one Evendeals request', async () => {
      const calls = stubEvenDeals(() => discountResponse(40));
      const [first, second] = await Promise.all([
        fetchEvenDealsQuote('203.0.113.1', null),
        fetchEvenDealsQuote('203.0.113.1', null),
      ]);
      const third = await fetchEvenDealsQuote('203.0.113.1', null);
      assert.equal(calls.length, 1);
      assert.equal(first?.discountPercentage, 40);
      assert.equal(second?.discountPercentage, 40);
      assert.equal(third?.discountPercentage, 40);
    });

    await run('different visitors and products are looked up separately', async () => {
      const calls = stubEvenDeals(() => discountResponse(30));
      await fetchEvenDealsQuote('203.0.113.2', null);
      await fetchEvenDealsQuote('203.0.113.3', null);
      await fetchEvenDealsQuote('203.0.113.2', 'product-2');
      assert.equal(calls.length, 3);
    });

    await run('a failed lookup shows the list price and is asked again next time', async () => {
      let status = 503;
      const calls = stubEvenDeals(() => (status === 200
        ? discountResponse(25)
        : new Response('', { status })));
      const failed = await fetchEvenDealsQuote('203.0.113.4', null);
      assert.equal(failed, null);
      status = 200;
      const retried = await fetchEvenDealsQuote('203.0.113.4', null);
      assert.equal(calls.length, 2);
      assert.equal(retried?.discountPercentage, 25);
    });

    await run('no discount (204) is kept, so the visitor is not asked about again', async () => {
      const calls = stubEvenDeals(() => new Response(null, { status: 204 }));
      assert.equal(await fetchEvenDealsQuote('203.0.113.5', null), null);
      assert.equal(await fetchEvenDealsQuote('203.0.113.5', null), null);
      assert.equal(calls.length, 1);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('All Evendeals quote cache tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
