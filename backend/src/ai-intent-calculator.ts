import { getAnthropicClient } from "./anthropic-client";

export interface IntentCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  dataPath: string;
}

export async function calculateIntentsWithAI(siteData: any): Promise<IntentCard[]> {
  const client = getAnthropicClient("anthropic");
  const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";

  const siteName = siteData.entries?.navbar?.logo_text || 
                   siteData.config?.title || 
                   "Website";

  const systemPrompt = `You are an expert at analyzing website data and understanding what users might want to explore or discover.

Your task is to think from a USER'S PERSPECTIVE - what would a visitor to this website want to know, explore, or discover? Don't just look at pages - think about user needs and intents.

Examples:
- Property website: Users might want to "Find Properties by Bedrooms", "Search by Price Range", "View Featured Listings", "Explore Neighborhoods"
- Portfolio website: Users might want to "View Tech Skills", "See Projects", "Read About Experience", "Check Education Background"
- Restaurant website: Users might want to "Browse Menu Items", "See Chef's Specials", "View Location & Hours", "Read Reviews"
- Business website: Users might want to "Learn About Services", "See Pricing", "View Team Members", "Read Case Studies"

Return ONLY a valid JSON array of intent objects. Each intent should have:
- id: a unique identifier (kebab-case, e.g., "find-properties", "tech-skills", "menu-items")
- title: a short, engaging title from user's perspective (2-5 words, e.g., "Find Your Dream Home", "View Tech Skills")
- description: a brief description of what the user will discover (10-20 words)
- icon: a single emoji that represents the intent
- dataPath: a path or multiple paths (comma-separated) to access ALL relevant data for this intent. Can be:
  * Single path: "entries.properties"
  * Multiple paths: "entries.properties,entries.featured"
  * Array access: "pages[0].sitesections[1]"
  * Root level: "entries" (to get all entries)
  * Use "root" to access the entire siteData if needed

IMPORTANT:
- Return ONLY the JSON array, no markdown, no backticks, no explanations
- Think about USER NEEDS, not just data structure
- Suggest 8-15 diverse intents covering different user interests
- Be creative - suggest intents based on what users might want, even if data is in different places
- The dataPath can point to multiple locations - use comma to separate if data is scattered
- Ensure dataPath(s) are valid and accessible in the data structure
- Use descriptive, user-friendly titles that speak to what the user wants to do`;

  const userPrompt = `Analyze this website data and suggest intent cards from a USER'S PERSPECTIVE.

Think: What would a visitor to this website want to explore, discover, or learn about?

Site name: ${siteName}

Website data structure (analyze the ENTIRE structure, not just pages):
${JSON.stringify(siteData, null, 2).substring(0, 15000)}

Examples of user-focused intents:
- For property sites: "Find Properties", "Search by Bedrooms", "View Featured Listings", "Explore Locations"
- For portfolios: "View Skills", "See Projects", "Read Experience", "Check Education"
- For restaurants: "Browse Menu", "See Specials", "View Hours", "Read Reviews"
- For businesses: "Learn Services", "See Pricing", "Meet Team", "View Portfolio"

Return a JSON array of 8-15 intent cards. Each card should represent something a USER would want to explore, not just a page in the data structure.`;

  try {
    const msg = await client.messages.create({
      model: model,
      max_tokens: 2000,
      temperature: 0.3,
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
    
    const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    const intents: IntentCard[] = JSON.parse(cleanJson);
    
    return intents
      .filter((intent: any) => 
        intent.id && 
        intent.title && 
        intent.description && 
        intent.icon && 
        intent.dataPath
      )
      .map((intent: any) => ({
        id: String(intent.id).toLowerCase().replace(/\s+/g, '-'),
        title: String(intent.title),
        description: String(intent.description),
        icon: String(intent.icon),
        dataPath: String(intent.dataPath)
      }));
  } catch (error: any) {
    console.error("AI intent calculation error:", error);
    return [];
  }
}

