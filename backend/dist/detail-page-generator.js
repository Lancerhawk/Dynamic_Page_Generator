"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDetailPageForItem = generateDetailPageForItem;
const anthropic_client_1 = require("./anthropic-client");
async function generateDetailPageForItem(intentTitle, itemTitle, itemData, siteName, themeColors, intentId) {
    const client = (0, anthropic_client_1.getAnthropicClient)("anthropic");
    const systemPrompt = `You generate beautiful, responsive HTML page content for a DETAIL page showing comprehensive information about a single item.

CRITICAL RULES - NO ASSUMPTIONS ALLOWED:
- Generate ONLY the content that goes inside <main> tag - NOT a full HTML document
- Use ONLY Tailwind CSS utility classes for styling (no custom CSS)
- The content will be injected into an existing page, so DO NOT include <html>, <head>, <body>, or <script> tags
- Make it visually stunning with Tailwind's utilities (gradients, shadows, hover effects, etc.)
- Ensure all content is fully responsive (mobile-first)
- Use proper semantic HTML (section, article, header, etc.)
- Return ONLY the HTML content, no markdown, no backticks, no explanations
- Create beautiful, detailed layouts with proper structure, spacing, and styling
- ABSOLUTELY FORBIDDEN: Never use placeholder text like {variable_name}, {label}, {text}, etc.
- ABSOLUTELY FORBIDDEN: Never make assumptions about what data should be - only use actual values from the provided JSON
- ALWAYS extract and display ACTUAL values from the provided data - NEVER make up values
- Display real content: actual names, descriptions, prices, images, text - never template variables, never assumptions
- If you cannot find a real value for a field, do not include that field - DO NOT make it up
- NEVER assume what a name, description, price, or any field should be - only use what exists in the data

COMPREHENSIVE DETAIL DISPLAY MANDATE:
- You MUST display ALL available information about this specific item comprehensively
- Show EVERY field, EVERY array item, EVERY nested detail available in the item data
- Do NOT summarize descriptions - display them in full
- Do NOT skip fields - if data exists, it must be shown
- Create detailed sections that show comprehensive information
- Use proper formatting to make all details readable and well-organized
- Include a "Back" link at the top that navigates back to the parent intent page`;
    const imageUrls = [];
    function extractImages(obj, path = '') {
        if (!obj || typeof obj !== 'object')
            return;
        if (path.includes('_context'))
            return;
        const imageFields = ['url', 'image', 'image_url', 'photo', 'photo_url', 'src', 'thumbnail', 'thumbnail_url', 'imageUrl', 'imageSrc'];
        for (const [key, value] of Object.entries(obj)) {
            if (key === '_context')
                continue; // Skip context object
            if (imageFields.includes(key.toLowerCase()) && typeof value === 'string' && value.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
                imageUrls.push(value);
            }
            if (key.toLowerCase() === 'images' && Array.isArray(value)) {
                value.forEach((imgUrl) => {
                    if (typeof imgUrl === 'string' && imgUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
                        imageUrls.push(imgUrl);
                    }
                });
            }
            if (typeof value === 'object' && value !== null) {
                extractImages(value, path ? `${path}.${key}` : key);
            }
        }
    }
    extractImages(itemData);
    if (itemData._context?.fullSiteData) {
        extractImages(itemData._context.fullSiteData, 'fullSiteData');
    }
    const imageContext = imageUrls.length > 0
        ? `\n\nIMAGES FOUND FOR THIS ITEM (USE ALL OF THESE - THEY BELONG TO THIS SPECIFIC ITEM!):\n${imageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n\nCRITICAL: Display ALL these images prominently! These images belong to this specific item - use them all.`
        : '';
    const themeContext = themeColors && Object.keys(themeColors).length > 0
        ? `\n\nCRITICAL - THEME COLORS (USE ONLY THESE):\nPrimary: ${themeColors.primary}\nSecondary: ${themeColors.secondary}\nAccent: ${themeColors.accent}\nBackground: ${themeColors.background}\nText: ${themeColors.text}\n\nUse Tailwind arbitrary values: bg-[${themeColors.primary}], text-[${themeColors.primary}], etc.`
        : '';
    const intentIdSlug = intentId || intentTitle.toLowerCase().replace(/\s+/g, '-');
    const userPrompt = `Generate a COMPREHENSIVE detail page for: "${itemTitle}"

This is a detail page showing ALL information about this specific item.

Site name: ${siteName}
Parent intent: ${intentTitle}

Item data (CRITICAL: USE ONLY ACTUAL VALUES - NO PLACEHOLDERS, NO TEMPLATE VARIABLES!):
${JSON.stringify(itemData, null, 2).substring(0, 15000)}${imageContext}${themeContext}

CRITICAL DATA EXTRACTION RULES:
- Extract and display ONLY real, actual values from the JSON data above
- If a field contains placeholder patterns like {variable}, {label}, {text}, {name}, {title}, etc., DO NOT display it
- Instead, look for the actual value in the data structure or skip that field entirely
- For images: Use the specific images that belong to this item (from "image", "image_url", "images" fields)
- DO NOT use random images - use only the images associated with this item in the data
- For text fields: Extract the actual text content, not template variables
- For numbers: Use the actual numeric values from the data
- For dates: Use the actual date values from the data
- If you cannot find a real value for a field, omit that field completely - DO NOT make up values or use placeholders

Requirements:
- Create a beautiful, detailed page layout showing ALL information about this item
- Include a header with the item title
- Add a "Back" link at the top: <a href="#${intentIdSlug}" class="inline-flex items-center px-4 py-2 rounded-lg" style="background-color: ${themeColors?.primary || '#3b82f6'}; color: white;">← Back to ${intentTitle}</a>
- Display ALL fields, ALL arrays, ALL nested information
- Show ALL images prominently (use image gallery if multiple images)
- Format all data nicely (prices, dates, specifications, etc.)
- Use cards and sections to organize information
- Display EVERY detail - nothing should be omitted
- Use the provided theme colors throughout
- Make it comprehensive and detailed - this is a full detail page

Return ONLY the HTML content for the <main> section.`;
    const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";
    const msg = await client.messages.create({
        model: model,
        max_tokens: 4096,
        temperature: 0.4,
        system: systemPrompt,
        messages: [
            {
                role: "user",
                content: [{ type: "text", text: userPrompt }]
            }
        ]
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    let cleanHtml = text.trim();
    if (cleanHtml.includes("```")) {
        cleanHtml = cleanHtml.replace(/^```[\w]*\n?/gm, "").replace(/\n?```$/gm, "").trim();
    }
    cleanHtml = cleanHtml.replace(/<a\s+[^>]*href\s*=\s*["'](?!\#)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');
    cleanHtml = cleanHtml.replace(/<button\s+[^>]*(?:onclick|href)[^>]*>([\s\S]*?)<\/button>/gi, '');
    cleanHtml = cleanHtml.replace(/<div[^>]*>\s*<\/div>/gi, '');
    cleanHtml = cleanHtml.replace(/<span[^>]*>\s*<\/span>/gi, '');
    cleanHtml = cleanHtml.replace(/>\s{2,}</g, '><');
    cleanHtml = cleanHtml.trim();
    return cleanHtml;
}
