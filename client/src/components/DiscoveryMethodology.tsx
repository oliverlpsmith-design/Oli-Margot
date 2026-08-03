import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import {
  DISCOVERY_METHODOLOGY,
  type DiscoveryCategory,
} from "@/lib/discoveryMethodology";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";

interface DiscoveryMethodologyProps {
  category: DiscoveryCategory;
  className?: string;
}

export function DiscoveryMethodology({ category, className }: DiscoveryMethodologyProps) {
  const methodology = DISCOVERY_METHODOLOGY[category];

  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-card shadow-sm", className)}>
      <CardContent className="p-0">
        <Accordion type="single" collapsible>
          <AccordionItem value="methodology" className="border-0">
            <AccordionTrigger className="px-5 py-4 hover:no-underline md:px-6">
              <span className="flex min-w-0 items-start gap-3 text-left">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="h-4 w-4 text-primary" />
                </span>
                <span>
                  <span className="block font-semibold text-foreground">How We Find These</span>
                  <span className="mt-0.5 block text-xs font-normal leading-relaxed text-muted-foreground">
                    See the current signals, thresholds, scoring rules and limitations.
                  </span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-5 md:px-6">
              <p className="max-w-4xl leading-relaxed text-muted-foreground">
                {methodology.intro}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {methodology.criteria.map((criterion) => (
                  <div key={criterion.title} className="rounded-lg border bg-secondary/35 p-4">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{criterion.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {criterion.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-amber-300/50 bg-amber-50/70 p-4 dark:border-amber-700/50 dark:bg-amber-950/20">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                      Important limitations
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-950/75 dark:text-amber-100/75">
                      {methodology.limitations.map((limitation) => (
                        <li key={limitation} className="flex gap-2">
                          <span aria-hidden>•</span>
                          <span>{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
