"use client";

// Lifeline Reports, built on AG Studio: real gifts, failed gifts and donors, in the Pulse theme, with a
// custom heartbeat widget and AG Studio's own agents (connected through Lifeline's server) in the right panel.
import { useMemo, useState } from "react";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import {
  AgStudioAiModule,
  createAiHarness,
  directLlmRunner,
  studioTheme,
  type AgAiHarnessSetup,
  type AgBaseRegistry,
  type AgBaseWidgetDefinition,
  type AgDataSourcesDefinition,
  type AgDefaultWidgetDefinition,
  type AgReportState,
  type AgDefaultRegistry,
  type AgWidgetFormParams,
  type AgWidgetsConfig,
} from "ag-studio";
import type { StudioData } from "@/server/studio-data";
import { openaiAdapter } from "./openai-adapter";
import { PulseWidget, type PulseWidgetDef } from "./pulse-widget";

interface Registry extends AgBaseRegistry {
  widgets: readonly (AgDefaultWidgetDefinition | AgBaseWidgetDefinition<"giving-pulse", PulseWidgetDef>)[];
}

const usd = { format: "$#,##0" };
const day = { format: "dd mmm yyyy" };

const theme = studioTheme.withParams({
  backgroundColor: "#ffffff",
  foregroundColor: "#1a1414",
  textColor: "#1a1414",
  subtleTextColor: "#6b625c",
  accentColor: "#e5484d",
  borderColor: "#e7e1d8",
  borderRadius: 10,
  fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  browserColorScheme: "light",
  studioCanvasBackgroundColor: "#f8f5f0",
  studioWidgetBackgroundColor: "#ffffff",
  studioWidgetBorderRadius: 16,
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleFontSize: 15,
  studioPanelContainerBackgroundColor: "#fbf9f6",
  studioAiPanelWidth: 360,
  gridHeaderBackgroundColor: "#fbf9f6",
  gridHeaderTextColor: "#6b625c",
  chartFontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  chartTextColor: "#6b625c",
  chartAxisLineColor: "#e7e1d8",
  // Series colours: ink first (coral stays reserved for failures, as in the rest of Lifeline), then coral, then quiet tones.
  chartPaletteFills1Color: "#5b524c",
  chartPaletteStrokes1Color: "#5b524c",
  chartPaletteFills2Color: "#e5484d",
  chartPaletteStrokes2Color: "#e5484d",
  chartPaletteFills3Color: "#3e8e6a",
  chartPaletteStrokes3Color: "#3e8e6a",
  chartPaletteFills4Color: "#8a817a",
  chartPaletteStrokes4Color: "#8a817a",
  chartPaletteFills5Color: "#c9c0b6",
  chartPaletteStrokes5Color: "#c9c0b6",
});

function definition(d: StudioData): AgDataSourcesDefinition<Registry> {
  const dates = [...d.gifts.map((g) => g.date), ...d.failedGifts.map((f) => f.date)].sort();
  const from = dates[0] ?? new Date().toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  return {
    description: "Monthly giving at Larkhaven Food Bank, a small nonprofit. Donors give monthly through PayPal subscriptions. When a gift fails, Lifeline opens a rescue to win the donor back. Amounts are US dollars.",
    sources: [
      {
        id: "gifts",
        name: "Gifts",
        description: "One row per monthly gift PayPal charged. type is Recovered when the gift came back after a failure Lifeline rescued.",
        data: d.gifts,
        fields: [
          { id: "date", name: "Date", format: "dateFormat", formatOptions: day },
          { id: "donor", name: "Donor", format: "textFormat" },
          { id: "amount", name: "Amount", format: "currencyFormat", formatOptions: usd },
          { id: "type", name: "Type", format: "textFormat" },
        ],
      },
      {
        id: "failedGifts",
        name: "Failed gifts",
        description: "One row per monthly gift PayPal couldn't take. cause is PayPal's reason in plain words; status is where the rescue stands; fix is what the officer approved; recovered is money brought back; yearAtStake is twelve months of that donor's gift.",
        data: d.failedGifts,
        fields: [
          { id: "date", name: "Date", format: "dateFormat", formatOptions: day },
          { id: "donor", name: "Donor", format: "textFormat" },
          { id: "amount", name: "Amount", format: "currencyFormat", formatOptions: usd },
          { id: "cause", name: "Cause", format: "textFormat" },
          { id: "status", name: "Status", format: "textFormat" },
          { id: "fix", name: "Fix", format: "textFormat" },
          { id: "recovered", name: "Recovered", format: "currencyFormat", formatOptions: usd },
          { id: "yearAtStake", name: "Year at stake", format: "currencyFormat", formatOptions: usd },
        ],
      },
      {
        id: "donors",
        name: "Donors",
        description: "One row per monthly donor and their PayPal subscription.",
        data: d.donors,
        fields: [
          { id: "donor", name: "Donor", format: "textFormat" },
          { id: "monthlyGift", name: "Monthly gift", format: "currencyFormat", formatOptions: usd },
          { id: "status", name: "Status", format: "textFormat" },
          { id: "since", name: "Giving since", format: "dateFormat", formatOptions: day },
          { id: "gifts", name: "Gifts", format: "integerFormat" },
          { id: "lastGift", name: "Last gift", format: "dateFormat", formatOptions: day },
          { id: "failedPayments", name: "Failed payments", format: "integerFormat" },
        ],
      },
    ],
    calendars: [{ id: "calendar", label: "Calendar", range: { from: { type: "date", value: from }, to: { type: "date", value: to } }, fragments: ["year", "month", "week", "day"] }],
    relationships: [
      { id: "gifts-calendar", source: { tableId: "gifts", fieldId: "date" }, target: { calendarId: "calendar" } },
      { id: "failed-calendar", source: { tableId: "failedGifts", fieldId: "date" }, target: { calendarId: "calendar" } },
    ],
  };
}

const initialState: AgReportState<Registry> = {
  pages: [
    {
      id: "giving",
      widgets: {
        given: { type: "value", dataMapping: { value: [{ id: "gifts.amount", aggregation: "sum" }] }, format: { caption: { enabled: true, text: "Given, all time" } } },
        failed: { type: "value", dataMapping: { value: [{ id: "failedGifts.amount", aggregation: "sum" }] }, format: { caption: { enabled: true, text: "Failed gifts, all time" } } },
        recovered: { type: "value", dataMapping: { value: [{ id: "failedGifts.recovered", aggregation: "sum" }] }, format: { caption: { enabled: true, text: "Recovered by Lifeline" } } },
        donors: { type: "value", dataMapping: { value: [{ id: "donors.donor", aggregation: "countd" }] }, format: { caption: { enabled: true, text: "Monthly donors" } } },
        pulse: { type: "giving-pulse", dataMapping: { day: [{ id: "calendar::day" }], given: [{ id: "gifts.amount", aggregation: "sum" }], failed: [{ id: "failedGifts.amount", aggregation: "sum" }] }, format: { title: { enabled: true, text: "Giving pulse" } } },
        trend: {
          type: "column-chart-grouped",
          dataMapping: { categoryKey: [{ id: "calendar::month" }], valueKey: [{ id: "gifts.amount", aggregation: "sum" }], tooltipKey: [] },
          sort: [{ field: { id: "calendar::month" }, direction: "asc" }],
          format: { title: { enabled: true, text: "Given per month" } },
        },
        causes: {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "failedGifts.cause" }], valueKey: [{ id: "failedGifts.amount", aggregation: "count" }], tooltipKey: [] },
          format: { title: { enabled: true, text: "Why gifts failed" } },
        },
        rescues: {
          type: "grid",
          dataMapping: { cols: [{ id: "failedGifts.date" }, { id: "failedGifts.donor" }, { id: "failedGifts.amount" }, { id: "failedGifts.cause" }, { id: "failedGifts.status" }, { id: "failedGifts.fix" }, { id: "failedGifts.recovered" }] },
          sort: [{ field: { id: "failedGifts.date" }, direction: "desc" }],
          format: { title: { enabled: true, text: "Rescues" } },
        },
      },
      widgetLayout: {
        given: { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 7 },
        failed: { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 7 },
        recovered: { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 7 },
        donors: { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 7 },
        pulse: { xTrack: 0, yTrack: 7, xSpan: 24, ySpan: 11 },
        trend: { xTrack: 0, yTrack: 18, xSpan: 14, ySpan: 16 },
        causes: { xTrack: 14, yTrack: 18, xSpan: 10, ySpan: 16 },
        rescues: { xTrack: 0, yTrack: 34, xSpan: 24, ySpan: 18 },
      },
    },
  ],
  selectedPageId: "giving",
  panels: { ai: { collapsed: false }, filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true } },
};

const widgets = (defaults: AgWidgetsConfig<AgDefaultRegistry>) =>
  createWidgets<Registry>({
  additionalTypes: [
    {
      id: "giving-pulse",
      label: "Giving pulse",
      icon: { url: "/pulse-widget.svg" },
      dataMapping: {
        day: { type: "field", supportedRoles: ["temporal"], requires: { cardinality: "one" }, required: true },
        given: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
        failed: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" } },
      },
      form: (params: AgWidgetFormParams<PulseWidgetDef>) => params.createDefaults({ dataMappingItems: [{ key: "day", label: "Day" }, { key: "given", label: "Given" }, { key: "failed", label: "Failed" }] }),
      comp: PulseWidget,
      defaultSize: { width: 900, height: 200 },
      minSize: { width: 300, height: 120 },
      ai: { description: "A heartbeat strip of giving per day: a beat up for money given, a coral dip for money that failed. Map day to calendar::day, given to a sum of gifts.amount, failed to a sum of failedGifts.amount." },
    },
  ],
  menu: [...defaults.menu, { label: "Lifeline", widgetIds: ["giving-pulse"] }],
  });

const adapter = openaiAdapter({ endpoint: "/api/studio-llm" });

const ai: AgAiHarnessSetup = ({ api }) =>
  createAiHarness(api, ({ builtIn }) => ({
    agents: Object.values(builtIn).map((def) =>
      def.id === "lead"
        ? directLlmRunner({
            ...def,
            adapter,
            name: "Lifeline AI",
            instructions: (ctx, p) =>
              `${def.instructions?.(ctx, p) ?? ""}\nYou help Tunde, the fundraising officer at a small food bank, understand monthly giving. Amounts are US dollars. Answer from the data; be brief. Prefer line charts for trends over time, and coral for failures. PayPal never shows the nonprofit a donor's card or bank, so never speculate about them.`,
          })
        : directLlmRunner({ ...def, adapter }),
    ),
    primary: "lead",
    promptStarters: [
      { label: "Why did giving dip?", prompt: "Look at giving and failed gifts over time. When did giving dip, and was it because of failed gifts?" },
      { label: "Chart recovered money", prompt: "Add a chart of money recovered per week from failed gifts." },
      { label: "Who's at risk?", prompt: "Which donors have failed gifts that aren't recovered yet, and how much a year is at stake?" },
    ],
  }));

// Opens as a finished report with the AI chat ready; the builder panels (filters, widget editing, data) only
// appear when the officer asks to customize. AG Studio's chat lives in edit mode, so the report stays in it.
export default function Studio({ data }: { data: StudioData }) {
  const [customize, setCustomize] = useState(false);
  // On a phone the AI panel would cover the whole report, so it starts folded there (Studio renders only in the
  // browser, so the width is known).
  const [startState] = useState(() => (window.innerWidth < 768 ? { ...initialState, panels: { ...initialState.panels, ai: { collapsed: true } } } : initialState));
  const def = useMemo(() => definition(data), [data]);
  const modules = useMemo(() => [AgStudioAiModule], []);
  const aiSetup = useMemo(() => ai, []);
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-1 lg:px-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Ask Lifeline AI for any chart in plain words, and it builds it here.</p>
        </div>
        <button type="button" aria-pressed={customize} onClick={() => setCustomize((c) => !c)} className="h-8 rounded-lg border border-line bg-surface px-3 text-sm text-ink-muted shadow-soft hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper">
          {customize ? "Done customizing" : "Customize"}
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <AgStudioProvider modules={modules} licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE}>
          <AgStudio<Registry>
            data={def}
            mode="edit"
            theme={theme}
            initialState={startState}
            widgets={widgets}
            ai={aiSetup}
            panels={{ edit: { left: customize ? ["filters", "edit", "data"] : [], right: ["ai"] } }}
            layout={{ minWidth: 560 }}
            localeText={{ panelTitleAi: "Lifeline AI", aiMessageInputPlaceholder: "Ask about your giving…" }}
            style={{ height: "100%", width: "100%" }}
          />
        </AgStudioProvider>
      </div>
    </div>
  );
}
