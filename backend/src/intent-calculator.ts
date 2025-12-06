export interface IntentCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  dataPath: string;
}

export function calculateIntents(siteData: any): IntentCard[] {
  const intents: IntentCard[] = [];

  if (siteData.entries?.navbar) {
    intents.push({
      id: "about-site",
      title: "About This Site",
      description: "Learn about the site's purpose and offerings",
      icon: "ℹ️",
      dataPath: "entries.navbar"
    });
  }

  if (siteData.entries?.footer) {
    intents.push({
      id: "contact",
      title: "Contact Information",
      description: "Get in touch with us",
      icon: "📞",
      dataPath: "entries.footer"
    });
  }

  if (siteData.pages) {
    siteData.pages.forEach((page: any, index: number) => {
      if (page.dish_name || page.menu_title) {
        intents.push({
          id: `menu-${index}`,
          title: "Browse Menu",
          description: "Explore our delicious offerings",
          icon: "🍽️",
          dataPath: `pages[${index}]`
        });
      }

      if (page.sitesections && page.sitesections.length > 0) {
        page.sitesections.forEach((section: any, sectionIndex: number) => {
          if (section._block === "testimonials_section") {
            intents.push({
              id: `testimonials-${index}-${sectionIndex}`,
              title: "Customer Testimonials",
              description: "See what our customers say",
              icon: "⭐",
              dataPath: `pages[${index}].sitesections[${sectionIndex}]`
            });
          }
          
          if (section._block === "featured_dishes_section") {
            intents.push({
              id: `featured-${index}-${sectionIndex}`,
              title: "Featured Dishes",
              description: "Check out our chef's recommendations",
              icon: "👨‍🍳",
              dataPath: `pages[${index}].sitesections[${sectionIndex}]`
            });
          }
        });
      }
    });
  }

  const uniqueIntents = intents.filter((intent, index, self) =>
    index === self.findIndex((t) => t.title === intent.title)
  );

  return uniqueIntents;
}

export function extractDataByPath(data: any, path: string): any {
  if (path === "root" || path === "") {
    return data;
  }
  
  if (path.includes(',')) {
    const paths = path.split(',').map(p => p.trim());
    const results: any = {};
    
    paths.forEach((singlePath, index) => {
      const extracted = extractSinglePath(data, singlePath);
      if (extracted !== null && extracted !== undefined) {
        if (index === 0) {
          Object.assign(results, extracted);
        } else {
          if (Array.isArray(results) && Array.isArray(extracted)) {
            results.push(...extracted);
          } else if (typeof results === 'object' && typeof extracted === 'object' && !Array.isArray(results) && !Array.isArray(extracted)) {
            Object.assign(results, extracted);
          } else {
            const key = singlePath.split(/[\.\[\]]/).pop() || `data${index}`;
            results[key] = extracted;
          }
        }
      }
    });
    
    return Object.keys(results).length > 0 ? results : null;
  }
  
  return extractSinglePath(data, path);
}

function extractSinglePath(data: any, path: string): any {
  const parts = path.split(/[\.\[\]]/).filter(Boolean);
  let result = data;
  
  for (const part of parts) {
    if (result === undefined || result === null) return null;
    result = result[part];
  }
  
  return result;
}

