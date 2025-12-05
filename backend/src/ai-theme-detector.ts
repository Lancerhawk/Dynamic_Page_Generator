import { getAnthropicClient } from "./anthropic-client";
import { ThemeColors } from "./theme-extractor";

export async function detectThemeColorsWithAI(siteData: any): Promise<ThemeColors> {
  const client = getAnthropicClient("anthropic");
  const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";

  const systemPrompt = `You are an expert at analyzing website data and detecting brand colors and theme.

Your task is to analyze the provided SleekCMS website data and identify the primary brand colors.

Return ONLY a valid JSON object with this exact structure:
{
  "primary": "#hexcolor",
  "secondary": "#hexcolor", 
  "accent": "#hexcolor",
  "background": "#hexcolor",
  "text": "#hexcolor"
}

IMPORTANT:
- Return ONLY the JSON object, no markdown, no backticks, no explanations
- Use hex color codes (e.g., "#f97316" for orange, "#3b82f6" for blue)
- Primary color should be the main brand color (most prominent)
- Secondary color should complement the primary
- Accent color should be for highlights/CTAs
- Background should be white (#ffffff) or light color
- Text should be dark (#1f2937 or similar)
- If you can't find colors, use sensible defaults but try to detect from the data first`;

  const userPrompt = `Analyze this website data and detect the brand/theme colors:

${JSON.stringify(siteData, null, 2).substring(0, 6000)}

Look for:
- Color fields in navbar, footer, config
- Brand colors mentioned in text
- Color values in styles or CSS
- Any orange, blue, or other color references
- The most prominent color used throughout

Return the theme colors as JSON.`;

  try {
    const msg = await client.messages.create({
      model: model,
      max_tokens: 500,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userPrompt }]
        }
      ]
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    
    let cleanJson = text.trim();
    if (cleanJson.includes("```")) {
      cleanJson = cleanJson.replace(/^```[\w]*\n?/gm, "").replace(/\n?```$/gm, "").trim();
    }
    
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    const detectedColors: ThemeColors = JSON.parse(cleanJson);
    
    return {
      primary: detectedColors.primary || '#3b82f6',
      secondary: detectedColors.secondary || '#8b5cf6',
      accent: detectedColors.accent || '#f59e0b',
      background: detectedColors.background || '#ffffff',
      text: detectedColors.text || '#1f2937'
    };
  } catch (error: any) {
    console.error("AI theme detection error:", error);
    return {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      background: '#ffffff',
      text: '#1f2937'
    };
  }
}

