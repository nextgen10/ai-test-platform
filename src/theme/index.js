/**
 * UBS Design System – Agent HUB theme tokens.
 *
 * A port of the UBS "FIT" tokens, extracted from the published stylesheets at
 * ubs.com (`/etc.clientlibs/ubs/fit/design/...`).
 *
 * Four rules define the UBS look, and they are why this file exists:
 *   1. Typography is system sans, Light or Medium only. Hierarchy comes from
 *      size and colour, never from weight.
 *   2. Corners are 2px. Not rounded, not square.
 *   3. Neutrals are warm stone (#f4f3ee, #b8b3a2), never blue-grey.
 *   4. Brand red is reserved for CTAs and links; focus stays blue.
 *
 * The stylesheet in `src/styles/globals.css` carries the same values as CSS
 * variables and is what paints the UI. This module exists for the places that
 * need a colour as a *value* — an inline SVG fill, a canvas, a computed tint —
 * where a `var()` cannot go.
 */

// ============================================================================
// UBS FIT colour tokens. Each pair is [light, dark], exactly as UBS ships them.
// ============================================================================

const T = {
    // -- Backgrounds: the UI ramp (10 lightest -> 80 darkest) -----------------
    bgUi10: ['#FFFFFF', '#1C1C1C'],
    bgUi10Hovered: ['#F4F3EE', '#2A2A2A'],
    bgUi20: ['#F9F9F7', '#2A2A2A'],
    bgUi20Hovered: ['#F4F3EE', '#1C1C1C'],
    bgUi30: ['#F4F3EE', '#2A2A2A'],
    bgUi30Hovered: ['#E0DFD7', '#1C1C1C'],
    bgUi40: ['#FBF9EE', '#2A2A2A'],
    bgUi40Hovered: ['#F3E8C3', '#1C1C1C'],
    bgUi80: ['#404040', '#CCCABC'],

    // -- Backgrounds: semantic ------------------------------------------------
    bgBrand: ['#E60000', '#D83B31'],
    bgBrandHovered: ['#8A000A', '#FF8C70'],
    bgPrimary: ['#1C1C1C', '#F4F3EE'],
    bgPrimaryHovered: ['#5A5D5C', '#B8B3A2'],
    bgSubtle: ['#5A5D5C', '#B8B3A2'],
    bgSubtler: ['#8E8D83', '#8E8D83'],
    bgInverted: ['#FFFFFF', '#1C1C1C'],
    bgDisabled: ['#CCCABC', '#5A5D5C'],
    bgError: ['#DA0000', '#E8696F'],
    bgWarning: ['#E4A911', '#875F03'],
    bgSuccess: ['#CAD67A', '#CAD67A'],
    bgHighlight01: ['#8A000A', '#FE6F5D'],
    bgHighlight02: ['#86671D', '#AF8626'],
    bgTags01: ['#F4F3EE', '#404040'],
    bgTags02: ['#E1EAA9', '#596318'],
    bgTags03: ['#EBD698', '#86671D'],
    bgTags04: ['#F3E8C3', '#654D16'],

    // -- Text -----------------------------------------------------------------
    textPrimary: ['#1C1C1C', '#F9F9F7'],
    textSubtle: ['#5A5D5C', '#E0DFD7'],
    textReadonly: ['#5A5D5C', '#B8B3A2'],
    textDisabled: ['#B8B3A2', '#5A5D5C'],
    textInverted: ['#FFFFFF', '#1C1C1C'],
    textInvertedStatic: ['#FFFFFF', '#F9F9F7'],
    textHighlight: ['#DA0000', '#FE6F5D'],

    // -- Borders --------------------------------------------------------------
    borderPrimary: ['#1C1C1C', '#F9F9F7'],
    borderSubtle: ['#5A5D5C', '#E0DFD7'],
    borderLight: ['#8E8D83', '#B8B3A2'],
    borderIllustrative: ['#CCCABC', '#7A7870'],
    borderBrand: ['#DA0000', '#D83B31'],
    borderDisabled: ['#B8B3A2', '#5A5D5C'],
    borderError: ['#DA0000', '#E8696F'],

    // -- Icons ----------------------------------------------------------------
    iconPrimary: ['#1C1C1C', '#F9F9F7'],
    iconSubtle: ['#5A5D5C', '#E0DFD7'],
    iconBrand: ['#DA0000', '#FE6F5D'],
    iconDisabled: ['#B8B3A2', '#5A5D5C'],

    // -- Links ----------------------------------------------------------------
    linkPrimary: ['#1C1C1C', '#F9F9F7'],
    linkBrand: ['#DA0000', '#FE6F5D'],
    linkBrandHovered: ['#8A000A', '#FF8C70'],

    // -- Focus (UBS uses a blue ring, deliberately not the brand red) ----------
    focusRing: ['#0769A6', '#4CA5E1'],
    focusGap: ['#FFFFFF', '#1C1C1C'],
};

/** UBS categorical chart ramp (`--col-chart-01..20`), in UBS's own order. */
const CHART = [
    ['#AF8626', '#AF8626'], ['#00759E', '#54AECF'], ['#879420', '#B4C054'],
    ['#4B2D58', '#D8AFE9'], ['#9F8865', '#B69F7C'], ['#2E476B', '#6187BD'],
    ['#469A6C', '#469A6C'], ['#AD3E4A', '#CC707A'], ['#8489BD', '#9DA2CD'],
    ['#0C7EC6', '#0C7EC6'], ['#654D16', '#CAA444'], ['#804C95', '#BF8CD4'],
    ['#45999C', '#45999C'], ['#4972AC', '#7D9FCF'], ['#CC707A', '#E2A2A9'],
    ['#295B40', '#92CEA9'], ['#545A9C', '#BBBEDD'], ['#785E4A', '#8D715E'],
    ['#07476F', '#83C5F1'], ['#620004', '#D83B31'],
];

/** Neutral (monochrome) graph ramp, `--col-graph-chart-01..05`. */
const GRAPH = [
    ['#8E8D83', '#7A7870'], ['#7A7870', '#B8B3A2'], ['#5A5D5C', '#E0DFD7'],
    ['#404040', '#F4F3EE'], ['#1C1C1C', '#FFFFFF'],
];

const pick = (pair, mode) => (mode === 'light' ? pair[0] : pair[1]);

/** Resolve the full UBS token set for one mode. */
export const getTokens = (mode) => {
    const t = (key) => pick(T[key], mode);
    return {
        background: {
            primary: t('bgUi10'),      // page / card ground
            secondary: t('bgUi20'),    // recessed panel
            tertiary: t('bgUi30'),     // rails, table headers
            accent: t('bgUi40'),       // callouts
            inverse: t('bgUi80'),
            hover: t('bgUi10Hovered'),
        },
        surface: {
            primary: t('bgUi10'),
            elevated: t('bgUi20'),
            sunken: t('bgUi30'),
        },
        border: {
            subtle: t('borderIllustrative'), // default divider / card edge
            light: t('borderLight'),
            strong: t('borderSubtle'),
            primary: t('borderPrimary'),
            brand: t('borderBrand'),
        },
        text: {
            primary: t('textPrimary'),
            secondary: t('textSubtle'),
            muted: t('textReadonly'),
            disabled: t('textDisabled'),
            inverse: t('textInverted'),
            brand: t('textHighlight'),
        },
        primary: {
            main: t('bgBrand'),
            hover: t('bgBrandHovered'),
            light: mode === 'light' ? '#FBEAEA' : 'rgba(216, 59, 49, 0.16)',
        },
        secondary: {
            main: t('bgPrimary'),
            hover: t('bgPrimaryHovered'),
            light: t('bgTags01'),
        },
        icon: {
            primary: t('iconPrimary'),
            subtle: t('iconSubtle'),
            brand: t('iconBrand'),
            disabled: t('iconDisabled'),
        },
        link: {
            primary: t('linkPrimary'),
            brand: t('linkBrand'),
            hover: t('linkBrandHovered'),
        },
        // UBS keeps status hues muted; only error carries the alert red.
        success: t('bgSuccess'),
        warning: t('bgWarning'),
        error: t('bgError'),
        info: pick(CHART[1], mode),
        focus: { ring: t('focusRing'), gap: t('focusGap') },
        tag: {
            neutral: t('bgTags01'),
            green: t('bgTags02'),
            amber: t('bgTags03'),
            sand: t('bgTags04'),
        },
        chart: {
            series: CHART.map((p) => pick(p, mode)),
            graph: GRAPH.map((p) => pick(p, mode)),
            // Named metric slots used across the evaluation panels.
            rqs: pick(CHART[1], mode),
            accuracy: pick(CHART[11], mode),
            completeness: pick(CHART[12], mode),
            consistency: pick(CHART[6], mode),
            safety: t('bgBrand'),
            hallucination: pick(CHART[7], mode),
            primary: t('bgBrand'),
        },
    };
};

/** Light-mode tokens, for modules that read colours outside of a React tree. */
export const colors = getTokens('light');

/**
 * Named categorical accents from the UBS chart ramp — use these instead of
 * Tailwind blues/purples/greens.
 */
export const getAccents = (mode) => {
    const tokens = getTokens(mode);
    const series = tokens.chart.series;
    return {
        brand: tokens.primary.main,
        gold: series[0],
        teal: series[1],
        olive: series[2],
        plum: series[3],
        bronze: series[4],
        navy: series[5],
        green: series[6],
        wine: series[7],
        periwinkle: series[8],
    };
};

export const accents = getAccents('light');

/** CSS variables for section bands — follow light/dark from globals.css. */
export const band = {
    page: 'var(--col-background-ui-10)',
    receded: 'var(--col-background-ui-20)',
    stone: 'var(--col-background-ui-30)',
    callout: 'var(--col-background-ui-40)',
};

/** UBS content grid: 12/24 columns, capped at 1290px. */
export const grid = {
    maxWidth: 1290,
    columns: 12,
    gutter: { xs: 20, md: 24, lg: 40 },
};

export const ubsFontStack =
    'system-ui, -apple-system, "Segoe UI", Roboto, Arial, Helvetica, sans-serif';

/** The only two weights in the UBS type system, plus the book default. */
export const weight = { light: 300, book: 400, medium: 500 };

/** UBS motion: a firm ease-out, short. */
export const motion = {
    duration: { fast: '0.15s', base: '0.2s', slow: '0.3s' },
    easing: 'cubic-bezier(0.38, 0.19, 0.32, 0.95)',
    transition: 'all 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
};

/**
 * A translucent tint of a hex colour.
 *
 * Stands in for MUI's `alpha()`, which several panels used to build a 6%–20%
 * wash behind a status colour.
 */
export function alpha(color, opacity) {
    const hex = String(color).replace('#', '');
    if (hex.length !== 6) return color;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** The palette entry a status tone names, resolved for the current mode. */
export function toneColor(tone, mode) {
    const c = getTokens(mode);
    switch (tone) {
        case 'success': return c.success;
        case 'warning': return c.warning;
        case 'error': return c.error;
        case 'info': return c.info;
        case 'primary': return c.primary.main;
        case 'secondary': return c.secondary.main;
        default: return c.text.disabled;
    }
}
