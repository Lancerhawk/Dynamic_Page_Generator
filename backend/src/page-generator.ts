import { getAnthropicClient } from "./anthropic-client";

export async function generatePageForIntent(
  intentTitle: string,
  intentDescription: string,
  relevantData: any,
  siteName: string,
  themeColors?: any,
  intentId?: string
): Promise<string> {
  const client = getAnthropicClient("anthropic");

  const systemPrompt = `You generate beautiful, responsive HTML page content for a single-page application.

CRITICAL RULES - NO ASSUMPTIONS ALLOWED:
- Generate ONLY the content that goes inside <main> tag - NOT a full HTML document
- Use ONLY Tailwind CSS utility classes for styling (no custom CSS)
- The content will be injected into an existing page, so DO NOT include <html>, <head>, <body>, or <script> tags
- Make it visually stunning with Tailwind's utilities (gradients, shadows, hover effects, etc.)
- Ensure all content is fully responsive (mobile-first)
- Use proper semantic HTML (section, article, header, etc.)
- Return ONLY the HTML content, no markdown, no backticks, no explanations
- Create beautiful card-based layouts with proper structure, spacing, and styling
- Cards should have: rounded-xl, shadow-md, hover:shadow-xl, p-6, border, proper spacing
- Use grid layouts for multiple items: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- ABSOLUTELY FORBIDDEN: Never use placeholder text like {variable_name}, {label}, {text}, {button_text}, {search_location_label}, etc.
- ABSOLUTELY FORBIDDEN: Never make assumptions about what data should be - only use actual values from the provided JSON
- ALWAYS extract and display ACTUAL values from the provided data - NEVER make up values
- If a field contains placeholder patterns, find the real value in the data structure or omit that field
- Display real content: actual names, descriptions, prices, images, text - never template variables, never assumptions
- If you cannot find a real value for a field, do not include that field in the output - DO NOT make it up
- All text, labels, and content must be real data from the provided JSON, not placeholders, not assumptions
- NEVER assume what a name, description, price, or any field should be - only use what exists in the data

COMPREHENSIVE DETAIL DISPLAY MANDATE:
- You MUST display ALL available information comprehensively - nothing should be omitted or summarized
- Show EVERY field, EVERY array item, EVERY nested detail available in the data
- Do NOT summarize descriptions - display them in full
- Do NOT skip fields - if data exists, it must be shown
- For each item (property, project, skill, menu item, etc.), display ALL its details completely
- Create detailed sections that show comprehensive information, not brief summaries
- Use expandable sections, detailed cards, or comprehensive layouts to show all information

DETAIL PAGE BUTTONS (CRITICAL - MUST ADD THESE):
- For EVERY item in a list (properties, projects, menu items, skills, etc.), you MUST add a "View Full Details" button
- The button MUST link to a detail page using hash navigation: <a href="#${intentId || intentTitle.toLowerCase().replace(/\s+/g, '-')}-detail-{itemId}" class="inline-flex items-center px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90" style="background-color: ${themeColors?.primary || '#3b82f6'};">View Full Details →</a>
- Use a unique identifier for each item (like property ID, project name, menu item ID, slug, name, title, etc.) to create the detail page ID
- Format: {intentId}-detail-{uniqueItemId} (e.g., "find-properties-detail-property-123" or "view-projects-detail-project-name" or "view-skills-detail-javascript")
- The itemId should be a unique identifier from the item data (id, _id, slug, name, title, property_id, project_id, skill_name, etc.)
- If an item doesn't have an ID, use a sanitized version of its name/title (lowercase, replace spaces with hyphens)
- The button should be styled with theme colors and be clearly visible at the bottom of each card
- Add this button to EVERY card/item in the page - it's essential for users to see full details`;

  const imageMap: Map<string, { url: string; itemPath: string; itemName?: string }> = new Map();
  
  function extractImagesWithContext(obj: any, path = '', itemName?: string): void {
    if (!obj || typeof obj !== 'object') return;
    
    if (path.includes('_context')) return;
    
    const imageFields = ['url', 'image', 'image_url', 'photo', 'photo_url', 'src', 'thumbnail', 'thumbnail_url', 'imageUrl', 'imageSrc'];
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (item && typeof item === 'object') {
          const itemName = item.name || item.title || item.dish_name || item.property_name || `Item ${index + 1}`;
          extractImagesWithContext(item, `${path}[${index}]`, itemName);
        }
      });
      return;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === '_context') continue;
      
      if (imageFields.includes(key.toLowerCase()) && typeof value === 'string' && value.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
        const currentItemName = itemName || obj.name || obj.title || obj.dish_name || obj.property_name || path.split('.').pop() || 'Unknown';
        imageMap.set(value, { url: value, itemPath: path, itemName: currentItemName });
      }
      
      if (key.toLowerCase() === 'images' && Array.isArray(value)) {
        const currentItemName = itemName || obj.name || obj.title || obj.dish_name || obj.property_name || path.split('.').pop() || 'Unknown';
        value.forEach((imgUrl, imgIndex) => {
          if (typeof imgUrl === 'string' && imgUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
            imageMap.set(imgUrl, { url: imgUrl, itemPath: `${path}.images[${imgIndex}]`, itemName: currentItemName });
          }
        });
      }
      
      if (typeof value === 'object' && value !== null) {
        const nextItemName = itemName || (key === 'featured_dishes' || key === 'dishes' || key === 'items' ? undefined : obj.name || obj.title);
        extractImagesWithContext(value, path ? `${path}.${key}` : key, nextItemName);
      }
    }
  }
  
  extractImagesWithContext(relevantData);
  
  if (relevantData._context?.fullSiteData) {
    extractImagesWithContext(relevantData._context.fullSiteData, 'fullSiteData');
  }
  
  let imageContext = '';
  if (imageMap.size > 0) {
    const imageList = Array.from(imageMap.values()).map((img, i) => {
      return `${i + 1}. ${img.url} (belongs to: ${img.itemName || img.itemPath})`;
    });
    imageContext = `\n\nIMAGES FOUND IN DATA (MATCH EACH IMAGE TO ITS CORRECT ITEM!):
${imageList.join('\n')}

CRITICAL IMAGE MATCHING RULES:
- Each image URL must be matched to the correct item based on the data structure
- If an item has an "image" or "image_url" field, use that EXACT image for that item
- If an item has an "images" array, use ALL images from that array for that item
- DO NOT randomly assign images - match them based on the item name/path shown above
- DO NOT reuse the same image for multiple items
- If an item has no image in the data, do not add an image - omit it`;
  }

  const themeContext = themeColors && Object.keys(themeColors).length > 0
    ? `\n\nCRITICAL - THEME COLORS (USE ONLY THESE - NO OTHER COLORS!):\nPrimary: ${themeColors.primary}\nSecondary: ${themeColors.secondary}\nAccent: ${themeColors.accent}\nBackground: ${themeColors.background}\nText: ${themeColors.text}\n\nMANDATORY COLOR USAGE:\n- ALL headings (h1, h2, h3) MUST use text-[${themeColors.primary}] or text-[${themeColors.text}]\n- ALL buttons MUST use bg-[${themeColors.primary}] with hover:opacity-90\n- ALL links MUST use text-[${themeColors.primary}]\n- ALL accents/highlights MUST use bg-[${themeColors.primary}] or bg-[${themeColors.accent}]\n- Background sections use bg-[${themeColors.background}]\n- Text content use text-[${themeColors.text}]\n\nDO NOT use blue (#3b82f6), orange (#f97316), yellow, or any other colors unless they match the theme colors above!\n\nUse Tailwind arbitrary values: bg-[${themeColors.primary}], text-[${themeColors.primary}], border-[${themeColors.primary}], etc.`
    : '';

  const dataString = JSON.stringify(relevantData, null, 2);
  const maxDataLength = 12000;
  let dataSections: string[] = [];
  
  if (dataString.length > maxDataLength) {
    const dataObj = relevantData;
    const keys = Object.keys(dataObj);
    const sectionSize = Math.ceil(keys.length / Math.ceil(dataString.length / maxDataLength));
    
    for (let i = 0; i < keys.length; i += sectionSize) {
      const sectionKeys = keys.slice(i, i + sectionSize);
      const sectionData: any = {};
      sectionKeys.forEach(key => {
        sectionData[key] = dataObj[key];
      });
      dataSections.push(JSON.stringify(sectionData, null, 2));
    }
  } else {
    dataSections = [dataString];
  }
  
  let dataContext = '';
  if (dataSections.length === 1) {
    dataContext = `Available data (CRITICAL: USE ONLY ACTUAL VALUES FROM THIS DATA - ABSOLUTELY NO PLACEHOLDERS, NO TEMPLATE VARIABLES, NO {variable_name} PATTERNS, NO ASSUMPTIONS!):
${dataSections[0]}`;
  } else {
    dataContext = `Available data (SPLIT INTO ${dataSections.length} SECTIONS - USE ALL SECTIONS, COMBINE THEM PROPERLY):
${dataSections.map((section, idx) => `\n=== SECTION ${idx + 1} OF ${dataSections.length} ===\n${section}`).join('\n\n')}

IMPORTANT: This data is split into ${dataSections.length} sections. You MUST use ALL sections and combine them properly. Do not skip any section.`;
  }

  const userPrompt = `Generate page content for: "${intentTitle}"

Description: ${intentDescription}

Site name: ${siteName}

${dataContext}${imageContext}${themeContext}

CRITICAL DATA EXTRACTION RULES - ABSOLUTELY NO ASSUMPTIONS:
- Extract and display ONLY real, actual values from the JSON data above - NEVER make assumptions
- If a field contains placeholder patterns like {variable}, {label}, {text}, {name}, {title}, {description}, etc., DO NOT display it
- Instead, look for the actual value in the data structure or skip that field entirely
- NEVER make up values - if you cannot find a real value, omit that field completely
- NEVER assume what a field should contain - only use what actually exists in the data
- For images: Match each image URL to the correct item/card based on the data structure
  * If an item has an "image" or "image_url" field, use that EXACT image URL for that item
  * If an item has an "images" array, use ALL images from that array for that item, in order
  * DO NOT use random images - each image must correspond to the correct item based on the data structure
  * DO NOT reuse the same image for multiple items - each item gets its own image(s) from the data
- For text fields: Extract the ACTUAL text content from the data, not template variables
- For numbers: Use the ACTUAL numeric values from the data
- For dates: Use the ACTUAL date values from the data
- For names/titles: Use the ACTUAL name/title from the data, not assumptions
- For descriptions: Use the ACTUAL description text from the data, not made-up descriptions
- If you cannot find a real value for a field, omit that field completely - DO NOT make up values, DO NOT use placeholders, DO NOT assume

CRITICAL: COMPREHENSIVE DETAIL DISPLAY REQUIRED

If the data contains a _context.fullSiteData field, you have access to the entire website data structure. 
You MUST search through the ENTIRE structure and display ALL relevant information comprehensively.

EXAMPLES OF COMPREHENSIVE DISPLAY:

For PROPERTY websites (intent like "Find Properties", "View Properties", etc.):
- Display EVERY property with ALL details: title, description, price, bedrooms, bathrooms, square footage, location, address, property type, year built, lot size, parking, amenities, features, images (ALL images), virtual tour links, agent info, contact details, availability status, etc.
- If properties have nested data (like amenities array, features array, images array), display EVERY item in those arrays
- Show ALL property specifications, ALL images, ALL descriptions - nothing should be omitted or summarized
- Create detailed cards showing complete information for each property

For PORTFOLIO websites (intent like "View Tech Skills", "See Projects", "Read Experience", etc.):
- Display ALL skills with proficiency levels, years of experience, certifications, projects using each skill
- Show ALL projects with: name, description, technologies used, duration, role, responsibilities, achievements, images, links, code repositories, etc.
- Display ALL work experience: company, role, duration, responsibilities (ALL of them), achievements, technologies, projects worked on
- Show ALL education: institution, degree, field, year, GPA, coursework, achievements, certifications
- Include ALL details - nothing should be summarized or left out

For RESTAURANT/MENU websites:
- Display ALL menu items with: name, description, price, ingredients (ALL ingredients), dietary information, images, category, preparation time, etc.
- Show ALL dishes, ALL sections, ALL details for each item

For BUSINESS/SERVICE websites:
- Display ALL services with: name, description, pricing (all tiers), features (all features), benefits, process, duration, requirements, etc.
- Show ALL team members with: name, role, bio, experience, skills, contact, image, etc.

GENERAL RULES FOR ALL INTENTS:
- Display EVERY field available in the data - do not skip any information
- If data contains arrays, display ALL items in those arrays
- If data contains nested objects, display ALL nested information
- Show ALL text content, ALL numbers, ALL dates, ALL images, ALL links
- Do NOT summarize - show complete details
- Do NOT omit information - if it exists in the data, it must be displayed
- Create comprehensive sections that show all available information
- Use expandable sections or detailed cards if needed to show all information
- For each item (property, project, skill, etc.), show key details in the overview
- CRITICAL: For EVERY item, you MUST add a "View Full Details" button that links to: #${intentId || intentTitle.toLowerCase().replace(/\s+/g, '-')}-detail-{itemId}
- The itemId should be the item's unique identifier (ID, name, slug, property_id, project_id, skill_name, etc.) from the data
- If no ID exists, use a sanitized version of the item's name/title (lowercase, spaces to hyphens)
- The detail button MUST be added to EVERY card/item - it's essential for the functionality

IMPORTANT: If the data contains placeholder patterns like {variable_name}, {label}, {text}, etc., you must:
1. Look for the actual value in the data structure
2. If no actual value exists, skip that field entirely
3. NEVER output placeholder text in your HTML
4. Always use real, meaningful content from the data

CRITICAL DATA USAGE RULES - STRICTLY ENFORCED - NO ASSUMPTIONS ALLOWED:
- Extract and display ONLY ACTUAL values from the data - NEVER use placeholder patterns like {variable}, {label}, {text}, {name}, {title}, {description}, {button_text}, etc.
- If you see ANY placeholder pattern in the data (e.g., {search_location_label}, {featured_title}, {property_name}), DO NOT display it
- Instead, search the data structure for the actual value, or if not found, skip that field entirely
- Display ONLY real text, real numbers, real images, real dates from the data - NEVER template variables
- NEVER make assumptions about what data should be - only use what actually exists in the JSON
- NEVER make up names, descriptions, prices, or any other values - only use actual values from the data
- For images: Each image URL must be matched to the correct item based on the data structure
  * If an item has an "image" or "image_url" field, use that EXACT image URL for that item
  * If an item has an "images" array, use ALL images from that array for that item, in the order they appear
  * DO NOT randomly assign images - match them based on the data structure
  * DO NOT reuse images across items - each item gets its own image(s) from the data
  * If an item has no image field, do not add an image - omit it
- For buttons: Use actual button text from data if available, otherwise create contextually appropriate text (but NEVER use placeholders)
- NEVER generate placeholder text - if you cannot find real content, omit that field
- NEVER make up values - only use what exists in the actual data
- NEVER assume what a field should contain - if it's not in the data, don't include it

Requirements:
- Create a beautiful, engaging page layout with proper card-based designs
- Display ALL relevant information from the data in well-structured cards - COMPREHENSIVE DETAILS REQUIRED
- Use cards, grids, and modern UI patterns - ensure cards have proper padding, borders, shadows, and spacing
- Include a header with the intent title at the top
- DO NOT add any "Back to Home" or navigation links - the header already has navigation
- CRITICAL: Use images from the data, but MATCH them correctly to each item!
- For each item/card, use the image(s) that belong to that specific item based on the data structure
- If an item has an "image", "image_url", "photo", "photo_url" field, use that image for that item
- If an item has an "images" array, use all images from that array for that item
- DO NOT randomly assign images - match each image to the correct item based on the data
- For images, use proper <img> tags with Tailwind classes: <img src="ACTUAL_IMAGE_URL_FROM_DATA" alt="item name from data" class="rounded-lg shadow-md w-full h-auto object-cover" />
- Display images prominently in cards - use them as card headers, backgrounds, or featured images
- If an item has no image in the data, do not add a placeholder image - just omit the image
- IMPORTANT: When displaying multiple items, ensure each item's image matches the correct item from the data structure
- If multiple items exist (like menu items, properties, products), create a grid of cards (grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6)
- Each card should have: proper padding (p-6), rounded corners (rounded-xl), shadow (shadow-md hover:shadow-xl), border (border border-gray-200)
- Format prices, dates, and other data nicely with proper typography
- CRITICAL: Use the provided theme colors throughout! Apply primary color to headings, buttons, accents. Use secondary color for complementary elements. Use text color for all text content.
- Use Tailwind's arbitrary value syntax for custom colors: bg-[#HEX], text-[#HEX], border-[#HEX], etc.
- DO NOT include any navigation buttons, links, or CTAs that go to external pages or other sections
- CRITICAL EXCEPTION: You MUST add "View Full Details" buttons to EVERY item/card that link to detail pages using hash navigation (e.g., href="#find-properties-detail-property-123")
- These detail buttons are ESSENTIAL - add them to every card/item in the page
- The button text must be exactly "View Full Details" (not "View Details" or "More Info")
- If data contains links or buttons, display the information they would link to directly on the page
- All interactive elements should be decorative only - no functional navigation links EXCEPT detail page links
- CRITICAL: NEVER use placeholder text like {variable}, {label}, {text}, {button_text}, etc.
- ALWAYS extract and display actual values from the data - if a field contains a placeholder pattern, either extract the real value or omit that field
- For text fields, use the actual text content from the data, not template variables
- If you see patterns like {search_location_label}, look for the actual label value in the data structure
- Display real, meaningful content - not template placeholders
- Ensure cards are properly structured with titles, descriptions, images, and prices clearly displayed

COMPREHENSIVE DETAIL REQUIREMENTS:
- Show EVERY field available in the data - do not skip any information
- Display ALL items in arrays (properties, projects, skills, menu items, etc.)
- Show ALL nested information (amenities, features, technologies, etc.)
- Include ALL text content, ALL numbers, ALL dates, ALL images
- Do NOT summarize descriptions - show them in full
- Do NOT omit details - if information exists, it must be displayed
- For properties: show ALL specifications (bedrooms, bathrooms, sqft, lot size, year built, parking, etc.)
- For portfolios: show ALL skills with details, ALL projects with full descriptions, ALL experience with complete responsibilities
- For menus: show ALL items with full descriptions, ALL ingredients, ALL prices, ALL dietary info
- Create detailed sections that comprehensively display all available information
- Use proper formatting to make all details readable and well-organized

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

  cleanHtml = cleanHtml.replace(/<a\s+[^>]*href\s*=\s*["']#["'][^>]*>([\s\S]*?)<\/a>/gi, '');
  
  cleanHtml = cleanHtml.replace(/<a\s+[^>]*href\s*=\s*["']#([^"']*-detail-[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '___DETAIL_LINK_MARKER___$1___SEPARATOR___$2___END_MARKER___');
  
  cleanHtml = cleanHtml.replace(/<a\s+[^>]*href\s*=\s*["'](?!\#|javascript:void)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');
  
  cleanHtml = cleanHtml.replace(/___DETAIL_LINK_MARKER___([^_]+)___SEPARATOR___([\s\S]*?)___END_MARKER___/gi, '<a href="#$1">$2</a>');
  
  cleanHtml = cleanHtml.replace(/<button\s+[^>]*href\s*=\s*["']#([^"']*-detail-[^"']*)["'][^>]*>([\s\S]*?)<\/button>/gi, '___DETAIL_BUTTON_MARKER___$1___SEPARATOR___$2___END_MARKER___');
  
  cleanHtml = cleanHtml.replace(/<button\s+[^>]*(?:onclick|href)[^>]*>([\s\S]*?)<\/button>/gi, '');
  
  cleanHtml = cleanHtml.replace(/___DETAIL_BUTTON_MARKER___([^_]+)___SEPARATOR___([\s\S]*?)___END_MARKER___/gi, '<a href="#$1" class="inline-flex items-center px-4 py-2 rounded-lg text-white font-semibold" style="background-color: ' + (themeColors?.primary || '#3b82f6') + ';">$2</a>');
  
  const buttonTextPatterns = [
    'Explore More', 'Learn More', 'Read More', 'View More', 'See More',
    'Discover More', 'Find Out More', 'Get Started', 'Sign Up', 'Register',
    'Book Now', 'Reserve', 'Order Now', 'Buy Now', 'Shop Now', 'Click Here',
    'More Info', 'Contact Us', 'Call Now'
  ];
  
  buttonTextPatterns.forEach(pattern => {
    const buttonRegex = new RegExp(`<button[^>]*(?!href=["']#.*-detail-)[^>]*>[^<]*${pattern.replace(/\s+/g, '[\\s\\S]*?')}[^<]*<\/button>`, 'gi');
    cleanHtml = cleanHtml.replace(buttonRegex, '');
    
    const linkRegex = new RegExp(`<a[^>]*(?!href=["']#.*-detail-)[^>]*>[^<]*${pattern.replace(/\s+/g, '[\\s\\S]*?')}[^<]*<\/a>`, 'gi');
    cleanHtml = cleanHtml.replace(linkRegex, '');
    
    const textRegex = new RegExp(`(?:<[^>]+>\\s*)?${pattern.replace(/\s+/g, '\\s+')}(?:\\s*<\\/[^>]+>)?`, 'gi');
    cleanHtml = cleanHtml.replace(textRegex, '');
  });
  
  cleanHtml = cleanHtml.replace(/<form\s+[^>]*>([\s\S]*?)<\/form>/gi, '<div>$1</div>');
  
  cleanHtml = cleanHtml.replace(/<div[^>]*>\s*<\/div>/gi, '');
  cleanHtml = cleanHtml.replace(/<span[^>]*>\s*<\/span>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>\s*<\/p>/gi, '');
  
  const placeholderPatterns = [
    /\{search_location_label\}/gi,
    /\{search_property_type_label\}/gi,
    /\{search_button_text\}/gi,
    /\{search_advanced_button_text\}/gi,
    /\{hero_background_image\.description\}/gi,
    /\{featured_title\}/gi,
    /\{featured_subtitle\}/gi,
    /\{label\}/gi,
    /\{text\}/gi,
    /\{button_text\}/gi,
    /\{title\}/gi,
    /\{description\}/gi,
    /\{name\}/gi,
    /\{value\}/gi,
    /\{placeholder\}/gi,
    /\{image\}/gi,
    /\{url\}/gi
  ];
  
  placeholderPatterns.forEach(pattern => {
    cleanHtml = cleanHtml.replace(new RegExp(`>\\s*${pattern.source}\\s*<`, 'gi'), '><');
    cleanHtml = cleanHtml.replace(new RegExp(`>\\s*${pattern.source}`, 'gi'), '>');
    cleanHtml = cleanHtml.replace(new RegExp(`${pattern.source}\\s*<`, 'gi'), '<');
  });
  
  cleanHtml = cleanHtml.replace(/>\s{2,}</g, '><');
  cleanHtml = cleanHtml.trim();

  return cleanHtml;
}