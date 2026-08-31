/**
 * UBS Design System – UBS Agent Hub Theme
 *
 * A faithful port of the UBS "FIT" design system tokens, extracted from the
 * published stylesheets at ubs.com (`/etc.clientlibs/ubs/fit/design/...`).
 *
 * Four rules define the UBS look, and they are why this file exists:
 *   1. Typography is Frutiger, and only ever Light or Medium. The web font maps
 *      weight 300-499 to Light and 500 to Medium, so anything above 500 is not
 *      a heavier UBS face -- it is a synthetic bold the brand does not use.
 *   2. Corners are 2px. Not rounded, not square.
 *   3. Neutrals are warm stone (#f4f3ee, #b8b3a2), never blue-grey.
 *   4. Hierarchy comes from size and colour, never from weight.
 */

// ============================================================================
// UBS FIT colour tokens. Each pair is light-dark(), exactly as UBS ships them.
// ============================================================================

type Pair = readonly [light: string, dark: string];

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
} as const satisfies Record<string, Pair>;

/** UBS categorical chart ramp (`--col-chart-01..20`), in UBS's own order. */
const CHART: readonly Pair[] = [
    ['#AF8626', '#AF8626'], ['#00759E', '#54AECF'], ['#879420', '#B4C054'],
    ['#4B2D58', '#D8AFE9'], ['#9F8865', '#B69F7C'], ['#2E476B', '#6187BD'],
    ['#469A6C', '#469A6C'], ['#AD3E4A', '#CC707A'], ['#8489BD', '#9DA2CD'],
    ['#0C7EC6', '#0C7EC6'], ['#654D16', '#CAA444'], ['#804C95', '#BF8CD4'],
    ['#45999C', '#45999C'], ['#4972AC', '#7D9FCF'], ['#CC707A', '#E2A2A9'],
    ['#295B40', '#92CEA9'], ['#545A9C', '#BBBEDD'], ['#785E4A', '#8D715E'],
    ['#07476F', '#83C5F1'], ['#620004', '#D83B31'],
];

/** Neutral (monochrome) graph ramp, `--col-graph-chart-01..05`. */
const GRAPH: readonly Pair[] = [
    ['#8E8D83', '#7A7870'], ['#7A7870', '#B8B3A2'], ['#5A5D5C', '#E0DFD7'],
    ['#404040', '#F4F3EE'], ['#1C1C1C', '#FFFFFF'],
];

const pick = (p: Pair, mode: 'light' | 'dark') => (mode === 'light' ? p[0] : p[1]);

/** Resolve the full UBS token set for one mode. */
export const getTokens = (mode: 'light' | 'dark') => {
    const t = <K extends keyof typeof T>(k: K) => pick(T[k], mode);
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
        // UBS keeps status hues muted; only error carries the brand red.
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

export type UbsTokens = ReturnType<typeof getTokens>;

/**
 * Named categorical accents from the UBS chart ramp — use these instead of
 * Tailwind blues/purples/greens. Brand red stays reserved for CTAs and alerts.
 */
export const getAccents = (mode: 'light' | 'dark') => {
    const series = getTokens(mode).chart.series;
    return {
        brand: getTokens(mode).primary.main,
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
} as const;

// ============================================================================
// Spacing -- UBS grid uses a 4px base with a 20/24/40px gutter progression.
// ============================================================================

export const spacing = {
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

/** UBS content grid: 12/24 columns, capped at 1290px. */
export const grid = {
    maxWidth: 1290,
    columns: 12,
    gutter: { xs: 20, md: 24, lg: 40 },
    margin: { xs: 20, sm: 34, md: 42, lg: 64, xl: 75 },
} as const;

// ============================================================================
// Typography -- Frutiger for UBS. Light (300-499) and Medium (500) only.
// ============================================================================

/**
 * "Frutiger for UBS" is a licensed face. We reference it by family name and
 * fall back to UBS's own declared stack (Arial/Helvetica), so the app renders
 * correctly whether or not the licensed files are present. See globals.css.
 */
export const ubsFontStack =
    '"Frutiger", "Frutiger for UBS", "FrutigerforUBSWeb", Arial, Helvetica, sans-serif';

export const ubsBrandFont = ubsFontStack;

/** The only two weights in the UBS type system. */
export const weight = { light: 300, book: 400, medium: 500 } as const;

export const typography = {
    fontFamily: ubsFontStack,
    // Headings are Light and large -- the signature UBS voice.
    h1: { fontSize: '2.5rem', fontWeight: weight.light, lineHeight: 1.15, letterSpacing: 0 },
    h2: { fontSize: '2rem', fontWeight: weight.light, lineHeight: 1.2, letterSpacing: 0 },
    h3: { fontSize: '1.5rem', fontWeight: weight.light, lineHeight: 1.25, letterSpacing: 0 },
    h4: { fontSize: '1.25rem', fontWeight: weight.medium, lineHeight: 1.3, letterSpacing: 0 },
    h5: { fontSize: '1.0625rem', fontWeight: weight.medium, lineHeight: 1.4, letterSpacing: 0 },
    h6: { fontSize: '0.9375rem', fontWeight: weight.medium, lineHeight: 1.4, letterSpacing: 0 },
    subtitle1: { fontSize: '1rem', fontWeight: weight.medium, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.875rem', fontWeight: weight.medium, lineHeight: 1.5 },
    body1: { fontSize: '1rem', fontWeight: weight.book, lineHeight: 1.55 },
    body2: { fontSize: '0.875rem', fontWeight: weight.book, lineHeight: 1.55 },
    caption: { fontSize: '0.75rem', fontWeight: weight.book, lineHeight: 1.45 },
    overline: { fontSize: '0.6875rem', fontWeight: weight.medium, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
    button: { textTransform: 'none' as const, fontWeight: weight.medium, letterSpacing: 0 },
} as const;

// ============================================================================
// Shape -- UBS corners are 2px. `radius` is the MUI shape unit, so an sx value
// of `borderRadius: 2` resolves to exactly 2px.
// ============================================================================

export const radius = 1;

export const shape = {
    none: 0, sm: 1, md: 2, lg: 2, xl: 6, pill: 9999, circle: '50%',
} as const;

/**
 * Select menus must match the closed field, not a hardcoded px width.
 * MUI already sets the paper's inline min-width to the trigger. `width: 0`
 * makes that the used width so long labels wrap instead of stretching the
 * list — which is what made dropdowns miss the box on other fonts/zoom.
 */
export const selectMenuProps = {
    disableScrollLock: true,
    transitionDuration: 0 as const,
    disableAutoFocusItem: true,
    marginThreshold: 0,
    anchorOrigin: { vertical: 'bottom' as const, horizontal: 'left' as const },
    transformOrigin: { vertical: 'top' as const, horizontal: 'left' as const },
    slotProps: {
        paper: {
            sx: {
                boxSizing: 'border-box' as const,
                width: '0 !important',
                maxWidth: 'none !important',
                overflowX: 'hidden',
            },
        },
    },
};

/** UBS motion: a firm ease-out, short. */
export const motion = {
    duration: { fast: '0.15s', base: '0.2s', slow: '0.3s' },
    easing: 'cubic-bezier(0.38, 0.19, 0.32, 0.95)',
    transition: 'all 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
} as const;

// ============================================================================
// MUI theme factory
// ============================================================================

import { createTheme, alpha } from '@mui/material/styles';

export const getUnifiedTheme = (mode: 'light' | 'dark') => {
    const c = getTokens(mode);
    const isLight = mode === 'light';

    // UBS elevates with a hairline and a whisper of shadow, never a soft glow.
    const hairline = `1px solid ${c.border.subtle}`;
    const restShadow = isLight ? '0 1px 2px rgba(0, 0, 0, 0.04)' : 'none';
    const raisedShadow = isLight ? '0 2px 6px rgba(0, 0, 0, 0.06)' : 'none';

    const focusVisible = {
        outline: `2px solid ${c.focus.ring}`,
        outlineOffset: '2px',
    };

    return createTheme({
        palette: {
            mode,
            primary: { main: c.primary.main, light: c.primary.light, dark: c.primary.hover, contrastText: '#FFFFFF' },
            secondary: { main: c.secondary.main, light: c.secondary.light, dark: c.secondary.hover, contrastText: c.text.inverse },
            background: { default: c.background.primary, paper: c.surface.primary },
            text: { primary: c.text.primary, secondary: c.text.secondary, disabled: c.text.disabled },
            success: { main: c.success, contrastText: '#1C1C1C' },
            warning: { main: c.warning, contrastText: '#1C1C1C' },
            error: { main: c.error, contrastText: '#FFFFFF' },
            info: { main: c.info, contrastText: '#FFFFFF' },
            divider: c.border.subtle,
            action: {
                hover: alpha(c.text.primary, isLight ? 0.04 : 0.08),
                selected: alpha(c.primary.main, isLight ? 0.08 : 0.16),
                disabled: c.text.disabled,
                disabledBackground: alpha(c.text.disabled, 0.25),
            },
        },

        typography: { ...typography },

        shape: { borderRadius: radius },

        components: {
            // ---- Global resets -------------------------------------------------
            MuiCssBaseline: {
                styleOverrides: {
                    body: { fontFamily: ubsFontStack, backgroundColor: c.background.primary },
                    // Never let a browser synthesise a bold Frutiger.
                    'strong, b': { fontWeight: weight.medium },
                    ':focus-visible': focusVisible,
                },
            },

            // UBS content column is 1290px (MUI xl defaults to 1536).
            MuiContainer: {
                styleOverrides: {
                    maxWidthXl: { maxWidth: `${grid.maxWidth}px` },
                },
            },

            MuiAccordion: {
                defaultProps: { elevation: 0, disableGutters: true },
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: c.surface.primary,
                        border: hairline,
                        borderRadius: `${shape.md}px !important`,
                        boxShadow: 'none',
                        '&:before': { display: 'none' },
                        '&.Mui-expanded': { margin: 0 },
                    },
                },
            },
            MuiAccordionSummary: {
                styleOverrides: {
                    root: { minHeight: 56, '&.Mui-expanded': { minHeight: 56 } },
                    content: { margin: '12px 0', '&.Mui-expanded': { margin: '12px 0' } },
                },
            },

            // ---- Buttons -------------------------------------------------------
            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: {
                    root: {
                        borderRadius: shape.md,
                        textTransform: 'none',
                        fontWeight: weight.medium,
                        boxShadow: 'none',
                        // Colour only — `all` animates width/padding when menus open.
                        transition: `background-color ${motion.duration.fast} ${motion.easing}, color ${motion.duration.fast} ${motion.easing}, border-color ${motion.duration.fast} ${motion.easing}, opacity ${motion.duration.fast} ${motion.easing}`,
                        '&:hover': { boxShadow: 'none' },
                        '&.Mui-focusVisible': focusVisible,
                    },
                    containedPrimary: {
                        backgroundColor: c.primary.main,
                        color: '#FFFFFF',
                        '&:hover': { backgroundColor: c.primary.hover },
                        '&.Mui-disabled': { backgroundColor: c.background.hover, color: c.text.disabled },
                    },
                    containedSecondary: {
                        backgroundColor: c.secondary.main,
                        color: c.text.inverse,
                        '&:hover': { backgroundColor: c.secondary.hover },
                    },
                    outlined: {
                        borderWidth: 1,
                        borderColor: c.border.primary,
                        color: c.text.primary,
                        '&:hover': { borderWidth: 1, borderColor: c.border.primary, backgroundColor: c.background.hover },
                    },
                    outlinedPrimary: {
                        borderColor: c.border.brand,
                        color: c.link.brand,
                        '&:hover': { borderColor: c.primary.hover, color: c.link.hover, backgroundColor: c.primary.light },
                    },
                    text: { color: c.text.primary, '&:hover': { backgroundColor: c.background.hover } },
                    textPrimary: { color: c.link.brand, '&:hover': { color: c.link.hover, backgroundColor: c.primary.light } },
                    sizeSmall: { fontSize: '0.8125rem', padding: '5px 14px' },
                    sizeMedium: { fontSize: '0.875rem', padding: '8px 20px' },
                    sizeLarge: { fontSize: '1rem', padding: '11px 28px' },
                },
            },

            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: shape.md,
                        color: c.icon.primary,
                        transition: `background-color ${motion.duration.fast} ${motion.easing}, color ${motion.duration.fast} ${motion.easing}`,
                        '&:hover': { backgroundColor: c.background.hover },
                        '&.Mui-focusVisible': focusVisible,
                    },
                },
            },

            MuiLink: {
                defaultProps: { underline: 'hover' },
                styleOverrides: {
                    root: {
                        color: c.link.brand,
                        textUnderlineOffset: '0.2em',
                        '&:hover': { color: c.link.hover },
                        '&.Mui-focusVisible': focusVisible,
                    },
                },
            },

            // ---- Surfaces ------------------------------------------------------
            MuiPaper: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: { backgroundImage: 'none', backgroundColor: c.surface.primary, borderRadius: shape.md },
                    outlined: { border: hairline },
                },
            },
            MuiCard: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: c.surface.primary,
                        border: hairline,
                        borderRadius: shape.md,
                        boxShadow: restShadow,
                    },
                },
            },
            MuiDialog: { styleOverrides: { paper: { border: hairline, borderRadius: shape.md, boxShadow: raisedShadow } } },
            MuiModal: {
                defaultProps: { disableScrollLock: true },
            },
            MuiPopover: {
                defaultProps: { disableScrollLock: true, transitionDuration: 0 },
                styleOverrides: { paper: { border: hairline, borderRadius: shape.md, boxShadow: raisedShadow } },
            },
            MuiMenu: {
                defaultProps: {
                    disableScrollLock: true,
                    transitionDuration: 0,
                    disableAutoFocusItem: true,
                },
                styleOverrides: {
                    paper: {
                        border: hairline,
                        borderRadius: shape.md,
                        boxShadow: raisedShadow,
                        overflow: 'auto',
                    },
                    list: { paddingTop: 4, paddingBottom: 4 },
                },
            },
            MuiSelect: {
                defaultProps: {
                    MenuProps: selectMenuProps,
                },
                styleOverrides: {
                    select: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        fontSize: '0.875rem',
                        '&:hover': { backgroundColor: c.background.hover },
                        '&.Mui-selected': { backgroundColor: c.background.tertiary },
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        backgroundColor: c.secondary.main,
                        color: c.text.inverse,
                        borderRadius: shape.md,
                        fontSize: '0.75rem',
                        fontWeight: weight.book,
                        padding: '6px 10px',
                    },
                    arrow: { color: c.secondary.main },
                },
            },

            // ---- Inputs --------------------------------------------------------
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: shape.md,
                        overflow: 'visible',
                        backgroundColor: c.surface.primary,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: c.border.light },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: c.border.primary },
                        // 2px on focus swallows the floating label in the notch.
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: c.focus.ring },
                        '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: c.border.brand },
                    },
                    input: { fontSize: '0.875rem' },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        fontSize: '0.875rem',
                        color: c.text.secondary,
                        '&.Mui-focused': { color: c.focus.ring },
                        '&.MuiInputLabel-shrink': {
                            backgroundColor: c.surface.primary,
                            paddingInline: 4,
                            marginLeft: -4,
                            zIndex: 1,
                        },
                    },
                },
            },
            MuiFormHelperText: { styleOverrides: { root: { fontSize: '0.75rem', marginLeft: 0 } } },
            MuiCheckbox: { styleOverrides: { root: { color: c.border.light, borderRadius: shape.sm, '&.Mui-checked': { color: c.primary.main } } } },
            MuiRadio: { styleOverrides: { root: { color: c.border.light, '&.Mui-checked': { color: c.primary.main } } } },
            MuiSwitch: { styleOverrides: { switchBase: { '&.Mui-checked': { color: c.primary.main }, '&.Mui-checked + .MuiSwitch-track': { backgroundColor: c.primary.main } } } },

            // ---- Navigation ----------------------------------------------------
            MuiAppBar: {
                defaultProps: { elevation: 0, color: 'inherit' },
                styleOverrides: {
                    root: {
                        backgroundColor: c.surface.primary,
                        color: c.text.primary,
                        borderBottom: hairline,
                        boxShadow: 'none',
                        backgroundImage: 'none',
                    },
                },
            },
            MuiTabs: { styleOverrides: { indicator: { backgroundColor: c.primary.main, height: 2 } } },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: weight.book,
                        fontSize: '0.875rem',
                        minHeight: 44,
                        color: c.text.secondary,
                        '&.Mui-selected': { color: c.text.primary, fontWeight: weight.medium },
                    },
                },
            },
            MuiDrawer: { styleOverrides: { paper: { backgroundColor: c.surface.primary, borderColor: c.border.subtle } } },

            // ---- Data display --------------------------------------------------
            MuiChip: {
                styleOverrides: {
                    // MUI's Chip base style hardcodes a 16px pill; the doubled
                    // class selector raises specificity so the UBS 2px corner wins.
                    root: {
                        '&.MuiChip-root': {
                            borderRadius: shape.md,
                            fontWeight: weight.book,
                            fontSize: '0.75rem',
                            height: 24,
                        },
                    },
                    outlined: { borderColor: c.border.light },
                    filled: { backgroundColor: c.tag.neutral, color: c.text.primary },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: { borderBottom: `1px solid ${c.border.subtle}`, fontSize: '0.875rem', padding: '12px 16px' },
                    head: { fontWeight: weight.medium, backgroundColor: c.background.tertiary, color: c.text.primary },
                },
            },
            MuiTableRow: { styleOverrides: { root: { '&:hover': { backgroundColor: c.background.hover } } } },
            MuiDivider: { styleOverrides: { root: { borderColor: c.border.subtle } } },
            MuiLinearProgress: {
                styleOverrides: {
                    root: { borderRadius: 0, height: 4, backgroundColor: c.background.tertiary },
                    bar: { borderRadius: 0, backgroundColor: c.primary.main },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: { borderRadius: shape.md, border: hairline, fontSize: '0.875rem' },
                    standardError: { backgroundColor: c.primary.light, color: c.text.primary, borderColor: c.border.brand },
                    standardSuccess: { backgroundColor: c.tag.green, color: '#1C1C1C' },
                    standardWarning: { backgroundColor: c.tag.amber, color: '#1C1C1C' },
                    standardInfo: { backgroundColor: c.background.accent, color: c.text.primary },
                },
            },
            MuiSkeleton: { styleOverrides: { root: { backgroundColor: c.background.tertiary, borderRadius: shape.md } } },
        },
    });
};

export const ubsTheme = getUnifiedTheme('light');

/** @deprecated Retained for backward compatibility; use `ubsTheme`. */
export const nexusTheme = ubsTheme;
