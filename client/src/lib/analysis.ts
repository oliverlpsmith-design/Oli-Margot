/** Frontend helpers for displaying subdivision analysis results. */

export type Verdict = "subdividable" | "marginal" | "not_subdividable" | "unknown";

export const VERDICT_META: Record<
  Verdict,
  { label: string; className: string }
> = {
  subdividable: {
    label: "Subdividable",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  marginal: {
    label: "Marginal",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  not_subdividable: {
    label: "Not subdividable",
    className: "bg-rose-100 text-rose-800 border-rose-300",
  },
  unknown: {
    label: "Needs data",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

export function formatSqm(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 10000) return `${(value / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;
  return `${Math.round(value).toLocaleString()} m²`;
}
