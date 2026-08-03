import { ALL_INVESTMENT_TAGS, INVESTMENT_TAG_LABELS } from "./investmentTags";
import { SUBDIVISION_CATEGORY } from "./subdivisionCategory";

export const NICHE_NAVIGATION = [
  {
    href: SUBDIVISION_CATEGORY.href,
    label: SUBDIVISION_CATEGORY.navigationLabel,
  },
  ...ALL_INVESTMENT_TAGS.map((tag) => ({
    href: `/niche/${tag}`,
    label: INVESTMENT_TAG_LABELS[tag],
  })),
] as const;
