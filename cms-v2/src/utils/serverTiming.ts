// False until this function instance has built one Server-Timing header, so cold starts show up.
let instanceWarm = false;

export type ServerTiming = {
  /** Records the time since `startedAt` (a performance.now() value) under `name`. */
  add(name: string, startedAt: number, description?: string): void;
  /** Recorded steps plus cold start, region and total, as a Server-Timing header value. */
  header(): string;
};

export function createServerTiming(): ServerTiming {
  const startedAt = performance.now();
  const coldStart = !instanceWarm;
  instanceWarm = true;
  const entries: string[] = [];

  const entry = (name: string, from: number, description?: string) => {
    const dur = (performance.now() - from).toFixed(1);
    return description ? `${name};desc="${description}";dur=${dur}` : `${name};dur=${dur}`;
  };

  return {
    add(name, from, description) {
      entries.push(entry(name, from, description));
    },
    header() {
      return [
        ...entries,
        `cold;desc="${coldStart ? 'cold start' : 'warm'}";dur=${coldStart ? 1 : 0}`,
        `region;desc="${process.env.VERCEL_REGION ?? 'local'}"`,
        entry('total', startedAt),
      ].join(', ');
    },
  };
}
