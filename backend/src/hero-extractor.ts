export interface HeroData {
  title: string;
  subtitle: string | null;
  image: string | null;
}

export function extractHeroData(siteData: any): HeroData {
  const title = siteData.entries?.navbar?.logo_text || 
                siteData.config?.title || 
                siteData.config?.name ||
                "Welcome";

  let subtitle: string | null = null;
  
  if (siteData.config?.description) {
    subtitle = siteData.config.description;
  } else if (siteData.config?.tagline) {
    subtitle = siteData.config.tagline;
  } else if (siteData.config?.subtitle) {
    subtitle = siteData.config.subtitle;
  }
  
  if (!subtitle && siteData.entries?.navbar?.tagline) {
    subtitle = siteData.entries.navbar.tagline;
  }
  
  // Check for hero section in pages
  if (!subtitle && siteData.pages) {
    for (const page of siteData.pages) {
      if (page.sitesections) {
        for (const section of page.sitesections) {
          if (section._block === "hero_section" || section._block === "hero") {
            if (section.subtitle) subtitle = section.subtitle;
            else if (section.description) subtitle = section.description;
            else if (section.tagline) subtitle = section.tagline;
          }
        }
      }
    }
  }
  
  if (!subtitle && siteData.pages && siteData.pages[0]) {
    const firstPage = siteData.pages[0];
    if (firstPage.description) subtitle = firstPage.description;
    else if (firstPage.subtitle) subtitle = firstPage.subtitle;
  }

  // Extract hero image
  let image: string | null = null;
  
  // Check for hero image in pages
  if (siteData.pages) {
    for (const page of siteData.pages) {
      if (page.sitesections) {
        for (const section of page.sitesections) {
          if (section._block === "hero_section" || section._block === "hero") {
            if (section.image?.url) image = section.image.url;
            else if (section.background_image?.url) image = section.background_image.url;
            else if (section.hero_image?.url) image = section.hero_image.url;
          }
        }
      }
    }
  }
  
  if (!image && siteData.config?.logo?.url) {
    image = siteData.config.logo.url;
  }
  
  if (!image && siteData.entries?.navbar?.logo?.url) {
    image = siteData.entries.navbar.logo.url;
  }

  return {
    title,
    subtitle: subtitle || null,
    image: image || null
  };
}

