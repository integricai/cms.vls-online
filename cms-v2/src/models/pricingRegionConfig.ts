import { sql } from '../db/client';

export type PricingRegionRow = {
  code: string;
  label: string;
  discountPercent: number;
  isActive: boolean;
  sortOrder: number;
  countries: string[];
};

type RegionDbRow = {
  code: string;
  label: string;
  discount_percent: string;
  is_active: boolean;
  sort_order: number;
};

type CountryDbRow = {
  country_code: string;
  region_code: string;
};

function rowToRegion(row: RegionDbRow, countries: string[]): PricingRegionRow {
  return {
    code: row.code,
    label: row.label,
    discountPercent: Number(row.discount_percent),
    isActive: row.is_active,
    sortOrder: row.sort_order,
    countries: countries.sort(),
  };
}

export async function listPricingRegions(): Promise<PricingRegionRow[]> {
  const regionRows = await sql`
    SELECT code, label, discount_percent, is_active, sort_order
    FROM pricing_regions
    ORDER BY sort_order, code
  ` as RegionDbRow[];

  if (regionRows.length === 0) return [];

  const countryRows = await sql`
    SELECT country_code, region_code
    FROM pricing_region_countries
    ORDER BY country_code
  ` as CountryDbRow[];

  const countriesByRegion = new Map<string, string[]>();
  for (const row of countryRows) {
    const list = countriesByRegion.get(row.region_code) ?? [];
    list.push(row.country_code);
    countriesByRegion.set(row.region_code, list);
  }

  return regionRows.map(row => rowToRegion(row, countriesByRegion.get(row.code) ?? []));
}

export async function replacePricingRegions(regions: PricingRegionRow[]): Promise<PricingRegionRow[]> {
  const normalized = regions.map((region, index) => ({
    code: region.code.trim().toUpperCase().replace(/\s+/g, '_'),
    label: region.label.trim(),
    discountPercent: Math.min(100, Math.max(0, Number(region.discountPercent) || 0)),
    isActive: region.isActive !== false,
    sortOrder: region.sortOrder ?? (index + 1) * 10,
    countries: [...new Set(
      region.countries
        .map(code => code.trim().toUpperCase())
        .filter(code => /^[A-Z]{2}$/.test(code)),
    )],
  }));

  const countryOwner = new Map<string, string>();
  for (const region of normalized) {
    for (const country of region.countries) {
      if (countryOwner.has(country)) {
        throw new Error(`Country ${country} is assigned to more than one region`);
      }
      countryOwner.set(country, region.code);
    }
  }

  await sql`DELETE FROM pricing_region_countries`;
  await sql`DELETE FROM pricing_regions`;

  for (const region of normalized) {
    await sql`
      INSERT INTO pricing_regions (code, label, discount_percent, is_active, sort_order)
      VALUES (
        ${region.code}, ${region.label}, ${region.discountPercent},
        ${region.isActive}, ${region.sortOrder}
      )
    `;
    for (const country of region.countries) {
      await sql`
        INSERT INTO pricing_region_countries (country_code, region_code)
        VALUES (${country}, ${region.code})
      `;
    }
  }

  return listPricingRegions();
}
