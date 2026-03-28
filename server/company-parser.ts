/**
 * Parse the OpenPhone Company field to extract structured data.
 * 
 * The user stores all customer info in the Company field in formats like:
 * - "PAUL SHAKOTKO Dartmouth 2006 Honda element"
 * - "Dave Gilmore 2010 Honda civic whistleberry phone calls only"
 * - "2013 Honda Ridgeline, Sydney"
 * - "Jocelyn Morris. Oxford,Cumberland 2015 Mitsubishi Outlander Need a spare key fob."
 * - "Keith Towse 2018 RAV4 Premium, VIN 2T3DFREV5JW724451"
 * - "Zack johnston (902) 317-3244"
 */

const VEHICLE_MAKES = [
  "acura", "alfa", "aston", "audi", "bentley", "bmw", "buick", "cadillac",
  "chevrolet", "chevy", "chrysler", "dodge", "ferrari", "fiat", "ford",
  "genesis", "gmc", "honda", "hyundai", "infiniti", "jaguar", "jeep",
  "kia", "lamborghini", "land rover", "lexus", "lincoln", "maserati",
  "mazda", "mclaren", "mercedes", "mini", "mitsubishi", "nissan",
  "porsche", "ram", "rolls", "saab", "subaru", "suzuki", "tesla",
  "toyota", "volkswagen", "vw", "volvo",
];

/** Common vehicle models that might appear without make */
const VEHICLE_MODELS = [
  "rav4", "crv", "cr-v", "civic", "accord", "camry", "corolla", "prius",
  "highlander", "tacoma", "tundra", "4runner", "sienna", "supra",
  "mustang", "f150", "f-150", "f250", "f-250", "explorer", "escape",
  "ranger", "bronco", "maverick", "edge", "flex", "fusion",
  "silverado", "equinox", "traverse", "blazer", "tahoe", "suburban",
  "malibu", "impala", "cruze", "spark", "trax", "colorado",
  "wrangler", "cherokee", "compass", "renegade", "gladiator",
  "altima", "sentra", "maxima", "rogue", "pathfinder", "frontier",
  "murano", "kicks", "versa", "titan", "armada",
  "elantra", "sonata", "tucson", "santa fe", "kona", "palisade",
  "forte", "optima", "sorento", "sportage", "telluride", "soul",
  "outback", "forester", "crosstrek", "impreza", "wrx", "legacy",
  "cx-5", "cx5", "cx-3", "cx3", "cx-9", "cx9", "mazda3", "mazda6",
  "outlander", "eclipse", "lancer", "mirage",
  "terrain", "acadia", "yukon", "sierra", "canyon",
  "ridgeline", "pilot", "passport", "odyssey", "element", "fit",
  "charger", "challenger", "durango", "journey", "caravan",
  "model 3", "model y", "model s", "model x",
  "3 series", "5 series", "x3", "x5",
  "a4", "a6", "q5", "q7",
  "c-class", "e-class", "glc", "gle",
  "is", "es", "rx", "nx",
];

/** Known Nova Scotia / Maritime cities and areas */
const KNOWN_LOCATIONS = [
  "halifax", "dartmouth", "sydney", "glace bay", "new glasgow", "truro",
  "amherst", "antigonish", "bridgewater", "kentville", "yarmouth",
  "pictou", "windsor", "wolfville", "digby", "lunenburg", "shelburne",
  "springhill", "stellarton", "westville", "new waterford", "dominion",
  "north sydney", "sydney mines", "louisbourg", "port hawkesbury",
  "canso", "guysborough", "sherbrooke", "musquodoboit", "sackville",
  "bedford", "cole harbour", "eastern passage", "porters lake",
  "tantallon", "timberlea", "hammonds plains", "fall river",
  "enfield", "elmsdale", "lantz", "brookfield", "stewiacke",
  "tatamagouche", "pugwash", "parrsboro", "oxford", "cumberland",
  "cape breton", "inverness", "baddeck", "cheticamp", "margaree",
  "arichat", "st peters", "mulgrave", "monastery", "pomquet",
  "heatherton", "havre boucher", "tracadie", "bayfield",
  "river john", "scotsburn", "alma", "malagash", "wallace",
  "wentworth", "bass river", "economy", "five islands",
  "great village", "debert", "masstown", "bible hill",
  "valley", "greenwood", "middleton", "berwick", "canning",
  "hantsport", "chester", "mahone bay", "liverpool",
  "barrington", "clark's harbour", "lockeport", "meteghan",
  "church point", "weymouth", "bear river", "annapolis royal",
  "cornwallis", "coldbrook", "new minas", "port williams",
  "orangedale", "whycocomagh", "iona", "christmas island",
  "albert bridge", "westmount", "reserve mines", "donkin",
  "birch grove", "gardiner mines", "tower road", "whitney pier",
  "ashby", "coxheath", "howie center", "ball creek",
  "leitches creek", "grand lake road", "blacketts lake",
  "moncton", "fredericton", "saint john", "charlottetown",
  "summerside", "bathurst", "miramichi", "campbellton",
  "woodstock", "edmundston", "oromocto", "dieppe",
  "riverview", "quispamsis", "rothesay", "sussex",
  "shediac", "bouctouche", "richibucto", "rexton",
  "petitcodiac", "hampton", "st stephen", "st andrews",
  "grand falls", "perth-andover", "florenceville",
  "hartland", "plaster rock", "dalhousie", "caraquet",
  "shippagan", "tracadie-sheila", "neguac", "rogersville",
  "blackville", "doaktown", "boiestown", "chipman",
  "minto", "oromocto", "gagetown", "grand bay-westfield",
  "quispamsis", "hampton", "norton", "apohaqui",
  "petitcodiac", "salisbury", "hillsborough",
  "hopewell cape", "alma", "fundy", "whistleberry",
  "ashfield",
];

export interface ParsedCompanyField {
  firstName: string;
  lastName: string;
  vehicle: string;     // "2006 Honda Element"
  location: string;    // "Dartmouth"
  vin: string;
  serviceNote: string; // "Need a spare key fob"
}

/**
 * Parse the Company field into structured components.
 */
export function parseCompanyField(company: string): ParsedCompanyField {
  if (!company || !company.trim()) {
    return { firstName: "", lastName: "", vehicle: "", location: "", vin: "", serviceNote: "" };
  }

  const result: ParsedCompanyField = {
    firstName: "",
    lastName: "",
    vehicle: "",
    location: "",
    vin: "",
    serviceNote: "",
  };

  // Clean up the company string
  let text = company.trim();

  // Extract VIN (17-char alphanumeric, often after "VIN" label)
  const vinMatch = text.match(/\bVIN\s*[:#]?\s*([A-HJ-NPR-Z0-9]{17})\b/i) ||
                   text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (vinMatch) {
    result.vin = vinMatch[1];
    text = text.replace(vinMatch[0], " ").trim();
  }

  // Extract phone numbers (remove them from parsing)
  text = text.replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, " ").trim();
  // Also remove +1 format
  text = text.replace(/\+1\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, " ").trim();

  // Extract vehicle: look for year (4 digits starting with 19/20) followed by make/model
  // First try to find year + known make
  // Then try year + known model
  // Then try year + any capitalized word(s)
  const yearMakeMatch = text.match(/\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9\s-]*?)(?=\s*(?:,|\.|$|\b(?:booked|need|spare|ignition|key|fob|push|start|phone|call|VIN|in\s|from\s))|\s*$)/i);
  
  if (yearMakeMatch) {
    const year = yearMakeMatch[1];
    let makeModel = yearMakeMatch[2].trim();
    
    // Clean trailing common words that aren't part of vehicle
    makeModel = makeModel.replace(/\s+(booked|need|spare|ignition|key|fob|push|start|phone|calls?\s+only|in|from).*$/i, "").trim();
    
    // Also check if any known location is at the end of makeModel and remove it
    const makeModelLower = makeModel.toLowerCase();
    for (const loc of KNOWN_LOCATIONS) {
      if (makeModelLower.endsWith(loc)) {
        makeModel = makeModel.slice(0, -loc.length).trim();
        if (!result.location) result.location = loc.charAt(0).toUpperCase() + loc.slice(1);
        break;
      }
    }
    
    result.vehicle = `${year} ${makeModel}`.trim();
    text = text.replace(yearMakeMatch[0], " ").trim();
  } else {
    // Try just year + known make or model
    const words = text.split(/[\s,]+/);
    for (let i = 0; i < words.length - 1; i++) {
      const cleaned = words[i].replace(/[^0-9]/g, "");
      if (/^(19|20)\d{2}$/.test(cleaned)) {
        const nextWord = words[i + 1]?.toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (VEHICLE_MAKES.includes(nextWord) || VEHICLE_MODELS.includes(nextWord)) {
          // Collect year + make + remaining model words
          const vehicleParts = [cleaned, words[i + 1]];
          for (let j = i + 2; j < words.length; j++) {
            const w = words[j].toLowerCase().replace(/[^a-z]/g, "");
            // Stop at known locations, service words, or punctuation-heavy words
            if (KNOWN_LOCATIONS.includes(w)) {
              result.location = words[j].charAt(0).toUpperCase() + words[j].slice(1).toLowerCase();
              break;
            }
            if (/^(booked|need|spare|ignition|key|fob|push|start|phone|calls?|only|in|from)$/i.test(w)) break;
            vehicleParts.push(words[j]);
          }
          result.vehicle = vehicleParts.join(" ").replace(/[,.]$/, "").trim();
          // Remove vehicle words from text
          for (const vp of vehicleParts) {
            text = text.replace(vp, " ");
          }
          text = text.trim();
          break;
        }
      }
    }
  }

  // Extract location from remaining text
  if (!result.location) {
    // Check for "in <Location>" pattern
    const inLocationMatch = text.match(/\bin\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,.]|\s*$)/);
    if (inLocationMatch) {
      const candidate = inLocationMatch[1].trim().toLowerCase();
      if (KNOWN_LOCATIONS.includes(candidate)) {
        result.location = inLocationMatch[1].trim();
        text = text.replace(inLocationMatch[0], " ").trim();
      }
    }
  }

  if (!result.location) {
    // Check each word/phrase against known locations
    const textLower = text.toLowerCase();
    // Try multi-word locations first
    const sortedLocations = [...KNOWN_LOCATIONS].sort((a, b) => b.length - a.length);
    for (const loc of sortedLocations) {
      const idx = textLower.indexOf(loc);
      if (idx >= 0) {
        // Make sure it's a word boundary
        const before = idx > 0 ? textLower[idx - 1] : " ";
        const after = idx + loc.length < textLower.length ? textLower[idx + loc.length] : " ";
        if (/[\s,.]/.test(before) || idx === 0) {
          if (/[\s,.]/.test(after) || idx + loc.length === textLower.length) {
            result.location = text.substring(idx, idx + loc.length).trim();
            // Capitalize first letter
            result.location = result.location.charAt(0).toUpperCase() + result.location.slice(1);
            text = (text.substring(0, idx) + " " + text.substring(idx + loc.length)).trim();
            break;
          }
        }
      }
    }
  }

  // Extract service notes
  const serviceMatch = text.match(/\b(need\s+.+|spare\s+key.+|ignition\s+.+|key\s+fob.+|push\s+to\s+start.+|programming.+|replacement.+)/i);
  if (serviceMatch) {
    result.serviceNote = serviceMatch[1].trim().replace(/[.]$/, "");
    text = text.replace(serviceMatch[0], " ").trim();
  }

  // Clean remaining text — what's left should be the name
  text = text.replace(/\b(booked|phone\s+calls?\s+only|VIN)\b/gi, " ").trim();
  text = text.replace(/[,.\s]+/g, " ").trim();
  text = text.replace(/\byear\b/gi, "").trim();

  // Remove the vehicle year if it's still in the text
  if (result.vehicle) {
    const yearFromVehicle = result.vehicle.match(/^(\d{4})/);
    if (yearFromVehicle) {
      text = text.replace(new RegExp(`\\b${yearFromVehicle[1]}\\b`), " ").trim();
    }
  }

  // What remains should be the name
  const nameWords = text.split(/\s+/).filter(w => w.length > 0 && !/^\d+$/.test(w));
  if (nameWords.length >= 2) {
    result.firstName = nameWords[0];
    result.lastName = nameWords.slice(1).join(" ");
  } else if (nameWords.length === 1) {
    result.firstName = nameWords[0];
  }

  return result;
}

/**
 * Build a clean display name from parsed data.
 * Priority: Name > Vehicle > Phone
 */
export function buildDisplayName(parsed: ParsedCompanyField, phone?: string): string {
  const parts: string[] = [];
  if (parsed.firstName) parts.push(parsed.firstName);
  if (parsed.lastName) parts.push(parsed.lastName);
  if (parts.length === 0 && parsed.vehicle) return parsed.vehicle;
  if (parts.length === 0 && phone) return phone;
  return parts.join(" ");
}
