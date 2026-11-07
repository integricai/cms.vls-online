import assert from 'assert';
import { assembleTrackingDays, trackingCustomBounds, trackingPresetBounds } from '../../shared/siteTracking';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

console.log('tracking range tests');

run('uses Monday weeks in London', () => {
  assert.deepStrictEqual(trackingPresetBounds('today', '2026-11-04'), {
    start: '2026-11-04',
    end: '2026-11-04',
  });
  assert.deepStrictEqual(trackingPresetBounds('yesterday', '2026-11-04'), {
    start: '2026-11-03',
    end: '2026-11-03',
  });
  assert.deepStrictEqual(trackingPresetBounds('this_week', '2026-11-04'), {
    start: '2026-11-02',
    end: '2026-11-04',
  });
  assert.deepStrictEqual(trackingPresetBounds('last_week', '2026-11-04'), {
    start: '2026-10-26',
    end: '2026-11-01',
  });
  assert.deepStrictEqual(trackingPresetBounds('this_month', '2026-11-04'), {
    start: '2026-11-01',
    end: '2026-11-04',
  });
  assert.deepStrictEqual(trackingPresetBounds('last_month', '2026-11-04'), {
    start: '2026-10-01',
    end: '2026-10-31',
  });
});

run('fills a zero for every channel on days with no visits', () => {
  assert.deepStrictEqual(
    assembleTrackingDays('2026-11-01', '2026-11-03', [
      { date: '2026-11-02', channel: 'Google Ads', visitors: 4 },
      { date: '2026-11-02', channel: 'Meta', visitors: 1 },
    ], ['Google Ads', 'Meta', 'Direct']),
    [
      { date: '2026-11-01', visitors: 0, channels: { 'Google Ads': 0, Meta: 0, Direct: 0 } },
      { date: '2026-11-02', visitors: 5, channels: { 'Google Ads': 4, Meta: 1, Direct: 0 } },
      { date: '2026-11-03', visitors: 0, channels: { 'Google Ads': 0, Meta: 0, Direct: 0 } },
    ],
  );
});

run('accepts a custom range of one year and rejects a longer one', () => {
  assert.deepStrictEqual(trackingCustomBounds('2025-11-04', '2026-11-04'), {
    start: '2025-11-04',
    end: '2026-11-04',
  });
  assert.equal(trackingCustomBounds('2025-11-03', '2026-11-04'), null);
  assert.equal(trackingCustomBounds('2026-11-04', '2026-11-01'), null);
  assert.equal(trackingCustomBounds('2026-02-31', '2026-03-01'), null);
});

console.log('tracking range tests passed');
