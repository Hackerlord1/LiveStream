// src/lib/api/team-normalization.ts

/**
 * Comprehensive team name normalization dictionary
 * Maps special characters and foreign names to clean, searchable names
 */

// Import Match type at the top
import type { Match } from './types';

export const TEAM_NORMALIZATION: Record<string, string[]> = {
    // ========== TURKISH TEAMS ==========
    'fenerbahce': ['fenerbahçe', 'fenerbahçe s.k.', 'fenerbahçe sk', 'fenerbahce sk'],
    'besiktas': ['beşiktaş', 'beşiktaş j.k.', 'beşiktaş jk', 'besiktas jk'],
    'galatasaray': ['galatasaray s.k.', 'galatasaray sk', 'galatasaray istanbul'],
    'istanbul-basaksehir': ['istanbul başakşehir', 'başakşehir', 'istanbul basaksehir'],
    'caykur-rizespor': ['çaykur rizespor', 'rizespor'],
    'trabzonspor': ['trabzonspor', 'trabzon'],
    'antalyaspor': ['antalyaspor'],
    'giresunspor': ['giresunspor'],
    'konyaspor': ['konyaspor'],
    'sivasspor': ['sivasspor'],
    'kayserispor': ['kayserispor'],
    'kasimpasa': ['kasımpaşa', 'kasimpasa'],
    'gaziantep': ['gaziantep f.k.', 'gaziantep'],
    'umraniyespor': ['ümraniyespor', 'umraniyespor'],
    'istanspor': ['istanspor', 'istanbulspor'],
    
    // ========== SPANISH TEAMS ==========
    'atletico-madrid': ['atlético madrid', 'atletico de madrid', 'atletico madrid'],
    'deportivo-la-coruna': ['deportivo la coruña', 'deportivo', 'la coruna'],
    'cadiz': ['cádiz cf', 'cadiz cf', 'cadiz'],
    'real-madrid': ['real madrid c.f.', 'real madrid cf', 'real madrid'],
    'barcelona': ['fc barcelona', 'barcelona fc'],
    'sevilla': ['sevilla fc', 'sevilla'],
    'valencia': ['valencia cf', 'valencia'],
    'athletic-bilbao': ['athletic club', 'athletic bilbao', 'bilbao'],
    'real-betis': ['real betis balompié', 'betis', 'real betis'],
    'villarreal': ['villarreal cf', 'villarreal'],
    'celta-vigo': ['celta de vigo', 'celta vigo', 'celta'],
    'espanyol': ['rcd espanyol', 'espanyol barcelona'],
    'real-sociedad': ['real sociedad', 'real sociedad de futbol'],
    'getafe': ['getafe cf', 'getafe'],
    'rayo-vallecano': ['rayo vallecano', 'rayo'],
    'osasuna': ['ca osasuna', 'osasuna pamplona'],
    
    // ========== ARGENTINIAN TEAMS ==========
    'velez-sarsfield': ['club atlético vélez sarsfield', 'vélez sarsfield', 'velez sarsfield'],
    'boca-juniors': ['boca juniors', 'boca'],
    'river-plate': ['club atlético river plate', 'river plate'],
    'racing-club': ['racing club', 'racing avellaneda'],
    'independiente': ['club atlético independiente', 'independiente avellaneda'],
    'san-lorenzo': ['san lorenzo de almagro', 'san lorenzo'],
    'newells-old-boys': ["newell's old boys", 'newells'],
    'rosario-central': ['rosario central'],
    'estudiantes': ['estudiantes de la plata', 'estudiantes lp'],
    'gimnasia': ['gimnasia y esgrima la plata', 'gimnasia lp'],
    'huracan': ['club atlético huracán', 'huracan'],
    'lanus': ['club atlético lanús', 'lanus'],
    
    // ========== GERMAN TEAMS ==========
    'borussia-monchengladbach': ['borussia mönchengladbach', 'gladbach', 'borussia mg'],
    'fc-koln': ['1. fc köln', 'fc köln', 'fc koln', 'koln'],
    'bayern-munich': ['fc bayern münchen', 'bayern munich', 'bayern'],
    'borussia-dortmund': ['borussia dortmund', 'bvb', 'dortmund'],
    'schalke': ['schalke 04', 'fc schalke 04', 'schalke'],
    'bayer-leverkusen': ['bayer 04 leverkusen', 'bayer leverkusen', 'leverkusen'],
    'eintracht-frankfurt': ['eintracht frankfurt', 'frankfurt'],
    'vfb-stuttgart': ['vfb stuttgart', 'stuttgart'],
    'hertha-berlin': ['hertha bsc', 'hertha berlin'],
    'rb-leipzig': ['rb leipzig', 'leipzig'],
    'wolfsburg': ['vfl wolfsburg', 'wolfsburg'],
    'werder-bremen': ['sv werder bremen', 'werder bremen', 'bremen'],
    'hamburger-sv': ['hamburger sv', 'hamburg'],
    'mainz': ['1. fsv mainz 05', 'mainz 05'],
    'augsburg': ['fc augsburg', 'augsburg'],
    'hannover': ['hannover 96', 'hannover'],
    
    // ========== SCANDINAVIAN TEAMS ==========
    // NORWAY
    'rosenborg': ['rosenborg bk', 'rosenborg trondheim'],
    'brann': ['sk brann', 'brann bergen'],
    'valerenga': ['vålerenga fotball', 'valerenga', 'vålerenga'],
    'molde': ['molde fk', 'molde'],
    'bodo-glimt': ['fk bodø/glimt', 'bodø glimt', 'bodo glimt'],
    'vikings': ['vikings fk', 'vikings stavanger'],
    
    // DENMARK
    'brondby': ['brøndby if', 'brondby if', 'brøndby', 'brondby'],
    'fc-copenhagen': ['fc københavn', 'fc copenhagen', 'copenhagen'],
    'aalborg': ['aab aalborg', 'aalborg bk'],
    'midtjylland': ['fc midtjylland', 'midtjylland'],
    'aarhus': ['agf aarhus', 'aarhus gf'],
    'odense': ['ob odense', 'odense boldklub'],
    
    // SWEDEN
    'malmo': ['malmö ff', 'malmo ff', 'malmö'],
    'aik': ['aik fotboll', 'aik stockholm'],
    'hammarby': ['hammarby if', 'hammarby'],
    'djurgarden': ['djurgårdens if', 'djurgarden', 'djurgårdens'],
    'ifk-norrkoping': ['ifk norrköping', 'ifk norrkoping', 'norrkoping'],
    'ifk-goteborg': ['ifk göteborg', 'ifk goteborg', 'goteborg'],
    'helsingborg': ['helsingborgs if', 'helsingborg'],
    
    // FINLAND
    'hjk-helsinki': ['hjk helsinki', 'helsinki'],
    'inter-turku': ['fc inter turku', 'inter turku'],
    'haka': ['fc haka', 'haka valkeakoski'],
    'kups': ['kuopion palloseura', 'kups kuopio'],
    'sjk': ['seinäjoki', 'sjk seinäjoki', 'seinajoki'],
    
    // ========== SWISS TEAMS ==========
    'young-boys': ['bsc young boys bern', 'young boys bern', 'young boys'],
    'fc-zurich': ['fc zürich', 'fc zurich', 'zurich'],
    'basel': ['fc basel', 'basel 1893'],
    'lausanne': ['fc lausanne-sport', 'lausanne sport'],
    'luzern': ['fc luzern', 'luzern'],
    'st-gallen': ['fc st. gallen', 'st. gallen'],
    'servette': ['servette fc', 'servette geneva'],
    'sion': ['fc sion', 'sion'],
    'grasshopper': ['grasshopper club zürich', 'grasshopper zurich'],
    
    // ========== POLISH TEAMS ==========
    'legia-warsaw': ['legia warszawa', 'legia warsaw', 'legia'],
    'lech-poznan': ['lech poznan', 'poznan'],
    'slask-wroclaw': ['śląsk wrocław', 'slask wroclaw', 'wroclaw'],
    'wisla-krakow': ['wisła kraków', 'wisla krakow', 'krakow'],
    'cracovia': ['ks cracovia', 'cracovia krakow'],
    'jagiellonia': ['jagiellonia białystok', 'jagiellonia bialystok'],
    'lks-lodz': ['łks łódź', 'lks lodz', 'lodz'],
    'lech-2': ['lech ii poznan', 'lech poznan ii'],
    'rakow-czestochowa': ['raków częstochowa', 'rakow czestochowa'],
    'gornik-zabrze': ['górnik zabrze', 'gornik zabrze'],
    'piast-gliwice': ['piast gliwice'],
    'widzew-lodz': ['widzew łódź', 'widzew lodz'],
    'radomiak': ['radomiak radom'],
    
    // ========== CZECH TEAMS ==========
    'sparta-prague': ['sparta praha', 'ac sparta praha', 'sparta'],
    'slavia-prague': ['slavia praha', 'sk slavia praha', 'slavia'],
    'viktoria-plzen': ['fc viktoria plzeň', 'viktoria plzen', 'plzen'],
    'banik-ostrava': ['baník ostrava', 'banik ostrava'],
    'slovacko': ['1. fc slovácko', 'slovacko'],
    'hradec-kralove': ['fc hradec králové', 'hradec kralove'],
    'teplice': ['fk teplice'],
    'jablonec': ['fk jablonec'],
    'ceske-budejovice': ['dynamo české budějovice', 'ceske budejovice'],
    'zlin': ['fastav zlín', 'zlin'],
    'mlada-boleslav': ['fk mladá boleslav', 'mlada boleslav'],
    
    // ========== OTHER EUROPEAN TEAMS ==========
    // PORTUGAL
    'benfica': ['sl benfica', 'benfica lisbon'],
    'porto': ['fc porto', 'porto'],
    'sporting-cp': ['sporting cp', 'sporting lisbon'],
    'braga': ['sc braga', 'braga'],
    
    // NETHERLANDS
    'ajax': ['afc ajax', 'ajax amsterdam'],
    'psv': ['psv eindhoven', 'eindhoven'],
    'feyenoord': ['feyenoord rotterdam', 'feyenoord'],
    
    // BELGIUM
    'club-brugge': ['club brugge kv', 'club brugge'],
    'anderlecht': ['rsc anderlecht', 'anderlecht'],
    'genk': ['krc genk', 'genk'],
    'standard-liege': ['standard liège', 'standard liege'],
    
    // GREECE
    'olympiacos': ['olympiacos cfp', 'olympiacos piraeus'],
    'paok': ['paok fc', 'paok thessaloniki'],
    'panathinaikos': ['panathinaikos fc', 'panathinaikos'],
    'aek-athens': ['aek athens fc', 'aek athens'],
    
    // UKRAINE
    'shakhtar-donetsk': ['fc shakhtar donetsk', 'shakhtar'],
    'dynamo-kyiv': ['fc dynamo kyiv', 'dynamo kiev'],
    
    // RUSSIA
    'zenit': ['fc zenit saint petersburg', 'zenit st. petersburg'],
    'cska-moscow': ['pfc cska moscow', 'cska moscow'],
    'spartak-moscow': ['fc spartak moscow', 'spartak moscow'],
    'lokomotiv-moscow': ['fc lokomotiv moscow', 'lokomotiv moscow'],
    
    // ========== CHILEAN TEAMS ==========
    'colocolo': ['colocolo', 'csd colo-colo'],
    'universidad-chile': ['universidad de chile', 'u. de chile'],
    'catolica': ['universidad católica', 'u. catolica'],
    'o-higgins': ["o'higgins", 'ohiggins'],
    'nublense': ['cd ñublense', 'nublense'],
    
    // ========== BRAZILIAN TEAMS ==========
    'flamengo': ['cr flamengo', 'flamengo'],
    'palmeiras': ['se palmeiras', 'palmeiras'],
    'santos': ['santos fc', 'santos'],
    'corinthians': ['sc corinthians paulista', 'corinthians'],
    'sao-paulo': ['são paulo fc', 'sao paulo'],
    'gremio': ['grêmio fbpa', 'gremio'],
    'internacional': ['sc internacional', 'internacional'],
    'atletico-mineiro': ['atlético mineiro', 'atletico mineiro'],
    'cruzeiro': ['cruzeiro ec', 'cruzeiro'],
    'vasco': ['cr vasco da gama', 'vasco da gama'],
    
    // ========== ENGLISH COMMON NAMES ==========
    'manchester-united': ['man utd', 'manchester utd', 'man united'],
    'manchester-city': ['man city'],
    'tottenham-hotspur': ['tottenham', 'spurs'],
    'newcastle-united': ['newcastle', 'newcastle utd'],
    'west-ham-united': ['west ham', 'west ham utd'],
    'leeds-united': ['leeds', 'leeds utd'],
    'nottingham-forest': ['nottingham forest', "nott'm forest", 'forest'],
    'wolverhampton-wanderers': ['wolves', 'wolverhampton'],
    'leicester-city': ['leicester', 'leicester city'],
};

/**
 * Special character mapping for direct replacements
 * NOTE: Each character appears only ONCE - no duplicates allowed
 */
export const SPECIAL_CHARACTERS: Record<string, string> = {
    // ========== TURKISH SPECIFIC ==========
    'ğ': 'g',
    'Ğ': 'G',
    'ı': 'i',   // Turkish dotless i (lowercase)
    'İ': 'I',   // Turkish dotted I (uppercase)
    'ş': 's',
    'Ş': 'S',
    
    // ========== GERMAN SPECIFIC ==========
    'ß': 'ss',
    
    // ========== SCANDINAVIAN SPECIFIC ==========
    'ø': 'o',
    'Ø': 'O',
    'å': 'a',
    'Å': 'A',
    'æ': 'ae',
    'Æ': 'AE',
    
    // ========== SHARED UMLAUTS (German/Turkish/Scandinavian) ==========
    'ä': 'a',
    'Ä': 'A',
    'ë': 'e',
    'Ë': 'E',
    'ï': 'i',
    'ö': 'o',
    'Ö': 'O',
    'ü': 'u',
    'Ü': 'U',
    'ÿ': 'y',
    
    // ========== SPANISH/PORTUGUESE ACCENTS ==========
    'á': 'a',
    'Á': 'A',
    'é': 'e',
    'É': 'E',
    'í': 'i',
    'Í': 'I',
    'ó': 'o',
    'Ó': 'O',
    'ú': 'u',
    'Ú': 'U',
    'ñ': 'n',
    'Ñ': 'N',
    'ã': 'a',
    'Ã': 'A',
    'õ': 'o',
    'Õ': 'O',
    
    // ========== FRENCH ACCENTS (Grave) ==========
    'à': 'a',
    'À': 'A',
    'è': 'e',
    'È': 'E',
    'ì': 'i',
    'Ì': 'I',
    'ò': 'o',
    'Ò': 'O',
    'ù': 'u',
    'Ù': 'U',
    
    // ========== FRENCH ACCENTS (Circumflex) ==========
    'â': 'a',
    'Â': 'A',
    'ê': 'e',
    'Ê': 'E',
    'î': 'i',
    'Î': 'I',
    'ô': 'o',
    'Ô': 'O',
    'û': 'u',
    'Û': 'U',
    
    // ========== CEDILLA (Shared Turkish/Portuguese/French) ==========
    'ç': 'c',
    'Ç': 'C',
    
    // ========== POLISH ==========
    'ą': 'a',
    'Ą': 'A',
    'ć': 'c',
    'Ć': 'C',
    'ę': 'e',
    'Ę': 'E',
    'ł': 'l',
    'Ł': 'L',
    'ń': 'n',
    'Ń': 'N',
    'ś': 's',
    'Ś': 'S',
    'ź': 'z',
    'Ź': 'Z',
    'ż': 'z',
    'Ż': 'Z',
    
    // ========== CZECH ==========
    'č': 'c',
    'Č': 'C',
    'ď': 'd',
    'Ď': 'D',
    'ě': 'e',
    'Ě': 'E',
    'ň': 'n',
    'Ň': 'N',
    'ř': 'r',
    'Ř': 'R',
    'š': 's',
    'Š': 'S',
    'ť': 't',
    'Ť': 'T',
    'ů': 'u',
    'Ů': 'U',
    'ž': 'z',
    'Ž': 'Z',
    
    // ========== GREEK (Transliteration) ==========
    'α': 'a',
    'Α': 'A',
    'β': 'v',
    'Β': 'B',
    'γ': 'g',
    'Γ': 'G',
    'δ': 'd',
    'Δ': 'D',
    'ε': 'e',
    'Ε': 'E',
    'ζ': 'z',
    'Ζ': 'Z',
    'η': 'i',
    'Η': 'I',
    'θ': 'th',
    'Θ': 'TH',
    'ι': 'i',
    'Ι': 'I',
    'κ': 'k',
    'Κ': 'K',
    'λ': 'l',
    'Λ': 'L',
    'μ': 'm',
    'Μ': 'M',
    'ν': 'n',
    'Ν': 'N',
    'ξ': 'x',
    'Ξ': 'X',
    'ο': 'o',
    'Ο': 'O',
    'π': 'p',
    'Π': 'P',
    'ρ': 'r',
    'Ρ': 'R',
    'σ': 's',
    'ς': 's',  // Final sigma
    'Σ': 'S',
    'τ': 't',
    'Τ': 'T',
    'υ': 'y',
    'Υ': 'Y',
    'φ': 'f',
    'Φ': 'F',
    'χ': 'ch',
    'Χ': 'CH',
    'ψ': 'ps',
    'Ψ': 'PS',
    'ω': 'o',
    'Ω': 'O',
    
    // ========== CROATIAN/SERBIAN ==========
    'đ': 'dj',
    'Đ': 'DJ',
    
    // ========== ROMANIAN ==========
    'ă': 'a',
    'Ă': 'A',
    'ș': 's',
    'Ș': 'S',
    'ț': 't',
    'Ț': 'T',
    
    // ========== ICELANDIC ==========
    'ð': 'd',
    'Ð': 'D',
    'þ': 'th',
    'Þ': 'TH',
    
    // ========== MISC ==========
    'œ': 'oe',
    'Œ': 'OE',
    
};

/**
 * Common team suffixes to remove
 */
export const TEAM_SUFFIXES: string[] = [
    'fc', 'cf', 'sk', 'jk', 'fk', 'ff', 'if', 'bk', 'kv', 'cfp',
    'football club', 'club de futbol', 'sport klub', 'idrottsförening',
    'fotbollsförening', 'fotbalový klub', 'fußball-club',
    'futbol klub', 'kulübü', 'società sportiva', 'sportverein',
    'sporting club', 'athletic club', 'r.s.c.', 's.c.', 'a.s.',
    'c.a.', 'c.f.', 'f.c.', 's.k.', 'j.k.', 'p.f.c.',
];

/**
 * Normalize a team name by removing special characters and standardizing
 */
export function normalizeTeamName(teamName: string): string {
    if (!teamName) return '';
    
    let normalized = teamName.toLowerCase().trim();
    
    // Step 1: Replace special characters
    for (const [special, replacement] of Object.entries(SPECIAL_CHARACTERS)) {
        normalized = normalized.split(special).join(replacement);
    }
    
    // Step 2: Remove common suffixes
    for (const suffix of TEAM_SUFFIXES) {
        const regex = new RegExp(`\\s+${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$|\\.)`, 'gi');
        normalized = normalized.replace(regex, ' ');
    }
    
    // Step 3: Remove extra punctuation
    normalized = normalized
        .replace(/[^a-z0-9\s]/g, ' ')  // Replace non-alphanumeric with space
        .replace(/\s+/g, ' ')           // Collapse multiple spaces
        .trim();
    
    // Step 4: Check against normalization dictionary
    for (const [cleanName, variations] of Object.entries(TEAM_NORMALIZATION)) {
        if (variations.includes(normalized) || 
            normalized.includes(cleanName.replace(/-/g, ' ')) ||
            cleanName.replace(/-/g, ' ').includes(normalized)) {
            return cleanName;
        }
    }
    
    // Step 5: Final cleanup for URL slug
    return normalized
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Create URL slug from team name
 */
export function createTeamSlug(teamName: string): string {
    return normalizeTeamName(teamName);
}

/**
 * Get all possible search variations for a team
 */
export function getTeamSearchVariations(teamName: string): string[] {
    const baseNormalized = normalizeTeamName(teamName);
    const variations = new Set<string>([baseNormalized]);
    
    // Add original lowercase
    variations.add(teamName.toLowerCase().trim());
    
    // Check dictionary for additional variations
    for (const [cleanName, dictVariations] of Object.entries(TEAM_NORMALIZATION)) {
        if (cleanName === baseNormalized) {
            dictVariations.forEach(v => variations.add(v));
        }
    }
    
    // Add variations without dashes
    baseNormalized.split('-').forEach(part => {
        if (part.length > 2) variations.add(part);
    });
    
    return Array.from(variations);
}

/**
 * Find a match by team names using normalization
 */
export function findMatchByTeams(
    homeTeam: string, 
    awayTeam: string, 
    matches: Match[]
): Match | undefined {
    if (!homeTeam || !awayTeam || !matches.length) {
        return undefined;
    }

    const normalizedHome = normalizeTeamName(homeTeam);
    const normalizedAway = normalizeTeamName(awayTeam);
    
    console.log('🔍 Searching for:', {
        home: { original: homeTeam, normalized: normalizedHome },
        away: { original: awayTeam, normalized: normalizedAway }
    });
    
    // Try exact normalized match
    let match = matches.find(m => {
        if (!m.homeTeam || !m.awayTeam) return false;
        return normalizeTeamName(m.homeTeam) === normalizedHome &&
               normalizeTeamName(m.awayTeam) === normalizedAway;
    });
    
    if (match) {
        console.log('✅ Found exact normalized match');
        return match;
    }
    
    // Try reversed (home/away swapped)
    match = matches.find(m => {
        if (!m.homeTeam || !m.awayTeam) return false;
        return normalizeTeamName(m.homeTeam) === normalizedAway &&
               normalizeTeamName(m.awayTeam) === normalizedHome;
    });
    
    if (match) {
        console.log('✅ Found reversed normalized match');
        return match;
    }
    
    // Try partial matches
    match = matches.find(m => {
        if (!m.homeTeam || !m.awayTeam) return false;
        const matchHome = normalizeTeamName(m.homeTeam);
        const matchAway = normalizeTeamName(m.awayTeam);
        
        const homeMatches = matchHome.includes(normalizedHome) || normalizedHome.includes(matchHome);
        const awayMatches = matchAway.includes(normalizedAway) || normalizedAway.includes(matchAway);
        
        return homeMatches && awayMatches;
    });
    
    if (match) {
        console.log('✅ Found partial normalized match');
        return match;
    }
    
    // Try with variations
    const homeVariations = getTeamSearchVariations(homeTeam);
    const awayVariations = getTeamSearchVariations(awayTeam);
    
    for (const homeVar of homeVariations) {
        for (const awayVar of awayVariations) {
            match = matches.find(m => {
                if (!m.homeTeam || !m.awayTeam) return false;
                const matchHome = m.homeTeam.toLowerCase();
                const matchAway = m.awayTeam.toLowerCase();
                
                const homeMatches = matchHome.includes(homeVar) || homeVar.includes(matchHome);
                const awayMatches = matchAway.includes(awayVar) || awayVar.includes(matchAway);
                
                return homeMatches && awayMatches;
            });
            
            if (match) {
                console.log(`✅ Found using variations: ${homeVar} vs ${awayVar}`);
                return match;
            }
        }
    }
    
    console.log('❌ No match found');
    return undefined;
}

/**
 * Compare two team names for similarity
 */
export function teamsMatch(team1: string, team2: string): boolean {
    if (!team1 || !team2) return false;
    
    const normalized1 = normalizeTeamName(team1);
    const normalized2 = normalizeTeamName(team2);
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // One contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
    
    // Check variations
    const variations1 = getTeamSearchVariations(team1);
    const variations2 = getTeamSearchVariations(team2);
    
    for (const v1 of variations1) {
        for (const v2 of variations2) {
            if (v1 === v2 || v1.includes(v2) || v2.includes(v1)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Get the canonical name for a team
 */
export function getCanonicalTeamName(teamName: string): string {
    const normalized = normalizeTeamName(teamName);
    
    // Check if it's in our dictionary
    for (const [canonical, variations] of Object.entries(TEAM_NORMALIZATION)) {
        if (canonical === normalized || variations.some(v => normalizeTeamName(v) === normalized)) {
            // Return a nicely formatted version
            return canonical
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
    }
    
    // Return the original with basic formatting
    return teamName
        .split(/[\s-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}