"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractThemeColors = extractThemeColors;
exports.getColorDescription = getColorDescription;
async function extractThemeColors(siteData) {
    const defaultTheme = {
        primary: '#3b82f6', // Blue
        secondary: '#8b5cf6', // Purple
        accent: '#f59e0b', // Amber
        background: '#ffffff',
        text: '#1f2937'
    };
    const colors = {};
    if (siteData.config?.theme) {
        const theme = siteData.config.theme;
        if (theme.primary)
            colors.primary = theme.primary;
        if (theme.secondary)
            colors.secondary = theme.secondary;
        if (theme.accent)
            colors.accent = theme.accent;
        if (theme.background)
            colors.background = theme.background;
        if (theme.text)
            colors.text = theme.text;
    }
    if (siteData.entries?.navbar) {
        const navbar = siteData.entries.navbar;
        if (navbar.primary_color)
            colors.primary = navbar.primary_color;
        if (navbar.background_color)
            colors.background = navbar.background_color;
        if (navbar.text_color)
            colors.text = navbar.text_color;
        if (navbar.bg_color)
            colors.background = navbar.bg_color;
        if (navbar.color)
            colors.text = navbar.color;
    }
    if (siteData.entries?.footer) {
        const footer = siteData.entries.footer;
        if (footer.primary_color)
            colors.primary = footer.primary_color;
        if (footer.background_color)
            colors.background = footer.background_color;
        if (footer.text_color)
            colors.text = footer.text_color;
    }
    // Check CSS variables or style settings
    if (siteData.styles) {
        const styles = siteData.styles;
        if (styles['--primary-color'])
            colors.primary = styles['--primary-color'];
        if (styles['--secondary-color'])
            colors.secondary = styles['--secondary-color'];
        if (styles['--accent-color'])
            colors.accent = styles['--accent-color'];
    }
    if (siteData.colors) {
        Object.assign(colors, siteData.colors);
    }
    if (siteData.pages) {
        siteData.pages.forEach((page) => {
            if (page.primary_color && !colors.primary)
                colors.primary = page.primary_color;
            if (page.accent_color && !colors.accent)
                colors.accent = page.accent_color;
        });
    }
    // If we found colors manually, use them
    if (colors.primary || colors.secondary || colors.accent) {
        return {
            primary: colors.primary || defaultTheme.primary,
            secondary: colors.secondary || defaultTheme.secondary,
            accent: colors.accent || defaultTheme.accent,
            background: colors.background || defaultTheme.background,
            text: colors.text || defaultTheme.text
        };
    }
    return {
        primary: defaultTheme.primary,
        secondary: defaultTheme.secondary,
        accent: defaultTheme.accent,
        background: defaultTheme.background,
        text: defaultTheme.text
    };
}
function getColorDescription(hex) {
    const colorMap = {
        '#f97316': 'orange',
        '#ea580c': 'orange',
        '#3b82f6': 'blue',
        '#2563eb': 'blue',
        '#8b5cf6': 'purple',
        '#10b981': 'green',
        '#ef4444': 'red',
        '#f59e0b': 'amber',
        '#06b6d4': 'cyan',
        '#ec4899': 'pink'
    };
    const normalized = hex.toLowerCase();
    return colorMap[normalized] || 'blue';
}
