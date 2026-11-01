import type { Place } from '../types';

/** Comprehensive fast-lookup gazetteer covering major hubs, metro stations, and landmarks across India. */
export const COMPREHENSIVE_PLACES: Place[] = [
  // ── Delhi NCR ──
  { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, source: 'osrm', placeId: 'del-cp' },
  { name: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295, source: 'osrm', placeId: 'del-ig' },
  { name: 'Janpath Market, New Delhi', lat: 28.6255, lng: 77.2185, source: 'osrm', placeId: 'del-jp' },
  { name: 'Hauz Khas Village, New Delhi', lat: 28.5535, lng: 77.1945, source: 'osrm', placeId: 'del-hkv' },
  { name: 'AIIMS Hospital, New Delhi', lat: 28.5672, lng: 77.2100, source: 'osrm', placeId: 'del-aiims' },
  { name: 'Safdarjung Hospital, New Delhi', lat: 28.5701, lng: 77.2078, source: 'osrm', placeId: 'del-sfd' },
  { name: 'New Delhi Railway Station (NDLS)', lat: 28.6430, lng: 77.2195, source: 'osrm', placeId: 'del-ndls' },
  { name: 'Delhi Airport Terminal 3 (IGI Airport)', lat: 28.5562, lng: 77.1000, source: 'osrm', placeId: 'del-t3' },
  { name: 'Saket Select Citywalk, New Delhi', lat: 28.5283, lng: 77.2190, source: 'osrm', placeId: 'del-skt' },
  { name: 'Lajpat Nagar Central Market, New Delhi', lat: 28.5700, lng: 77.2400, source: 'osrm', placeId: 'del-lp' },
  { name: 'Cyber City, DLF Phase 2, Gurugram', lat: 28.4950, lng: 77.0890, source: 'osrm', placeId: 'del-ggn' },
  { name: 'Sector 18 Atta Market, Noida', lat: 28.5708, lng: 77.3261, source: 'osrm', placeId: 'del-noid' },
  { name: 'Red Fort (Lal Qila), Old Delhi', lat: 28.6562, lng: 77.2410, source: 'osrm', placeId: 'del-rf' },
  { name: 'Chandni Chowk Metro Station, Old Delhi', lat: 28.6575, lng: 77.2305, source: 'osrm', placeId: 'del-cc' },
  { name: 'Karol Bagh Market, New Delhi', lat: 28.6450, lng: 77.1900, source: 'osrm', placeId: 'del-kb' },
  { name: 'Rajiv Chowk Metro Station, New Delhi', lat: 28.6328, lng: 77.2195, source: 'osrm', placeId: 'del-rc' },

  // ── Bengaluru ──
  { name: 'MG Road Metro Station, Bengaluru', lat: 12.9756, lng: 77.6068, source: 'osrm', placeId: 'blr-mgr' },
  { name: 'Indiranagar 100 Feet Road, Bengaluru', lat: 12.9784, lng: 77.6408, source: 'osrm', placeId: 'blr-ind' },
  { name: 'Koramangala Sony World Signal, Bengaluru', lat: 12.9345, lng: 77.6116, source: 'osrm', placeId: 'blr-kor' },
  { name: 'HSR Layout BDA Complex, Bengaluru', lat: 12.9116, lng: 77.6389, source: 'osrm', placeId: 'blr-hsr' },
  { name: 'Jayanagar 4th Block, Bengaluru', lat: 12.9250, lng: 77.5938, source: 'osrm', placeId: 'blr-jay' },
  { name: 'Majestic Kempegowda Bus Station, Bengaluru', lat: 12.9767, lng: 77.5713, source: 'osrm', placeId: 'blr-maj' },
  { name: 'Whitefield ITPL, Bengaluru', lat: 12.9855, lng: 77.7371, source: 'osrm', placeId: 'blr-wtf' },
  { name: 'Electronic City Phase 1, Bengaluru', lat: 12.8452, lng: 77.6602, source: 'osrm', placeId: 'blr-elc' },
  { name: 'Bellandur EcoSpace, Bengaluru', lat: 12.9260, lng: 77.6762, source: 'osrm', placeId: 'blr-bel' },
  { name: 'Hebbal Flyover, Bengaluru', lat: 13.0358, lng: 77.5970, source: 'osrm', placeId: 'blr-heb' },
  { name: 'Home (demo location)', lat: 12.9352, lng: 77.6245, source: 'osrm', placeId: 'demo-home' },

  // ── Mumbai ──
  { name: 'Marine Drive, Nariman Point, Mumbai', lat: 18.9220, lng: 72.8235, source: 'osrm', placeId: 'bom-md' },
  { name: 'Bandra Bandstand, Bandra West, Mumbai', lat: 19.0435, lng: 72.8195, source: 'osrm', placeId: 'bom-bnd' },
  { name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT), Mumbai', lat: 18.9400, lng: 72.8350, source: 'osrm', placeId: 'bom-cst' },
  { name: 'Andheri Metro Station, Mumbai', lat: 19.1197, lng: 72.8464, source: 'osrm', placeId: 'bom-and' },
  { name: 'Juhu Beach, Mumbai', lat: 19.0988, lng: 72.8264, source: 'osrm', placeId: 'bom-juh' },
  { name: 'Powai Hiranandani, Mumbai', lat: 19.1197, lng: 72.9051, source: 'osrm', placeId: 'bom-pow' },
  { name: 'Dadar Western Railway Station, Mumbai', lat: 19.0178, lng: 72.8478, source: 'osrm', placeId: 'bom-dad' },

  // ── Hyderabad, Chennai, Kolkata, Pune ──
  { name: 'Hitec City Cyber Towers, Hyderabad', lat: 17.4504, lng: 78.3808, source: 'osrm', placeId: 'hyd-hit' },
  { name: 'Banjara Hills Road No. 1, Hyderabad', lat: 17.4156, lng: 78.4485, source: 'osrm', placeId: 'hyd-ban' },
  { name: 'T Nagar Pondy Bazaar, Chennai', lat: 13.0418, lng: 80.2341, source: 'osrm', placeId: 'maa-tng' },
  { name: 'Marina Beach, Chennai', lat: 13.0500, lng: 80.2824, source: 'osrm', placeId: 'maa-mar' },
  { name: 'Park Street, Kolkata', lat: 22.5510, lng: 88.3525, source: 'osrm', placeId: 'ccu-prk' },
  { name: 'Howrah Railway Station, Kolkata', lat: 22.5857, lng: 88.3426, source: 'osrm', placeId: 'ccu-how' },
  { name: 'FC Road, Deccan Gymkhana, Pune', lat: 18.5204, lng: 73.8415, source: 'osrm', placeId: 'pnq-fcr' },
  { name: 'Viman Nagar Phoenix Marketcity, Pune', lat: 18.5626, lng: 73.9168, source: 'osrm', placeId: 'pnq-vim' },
];

export const DEMO_PLACES = COMPREHENSIVE_PLACES;

export function searchDemoPlaces(q: string): Place[] {
  const s = q.trim().toLowerCase();
  if (!s) return COMPREHENSIVE_PLACES.slice(0, 8);
  const words = s.split(/\s+/).filter(Boolean);
  return COMPREHENSIVE_PLACES.filter((p) => {
    const text = p.name.toLowerCase();
    return words.every((w) => text.includes(w));
  }).slice(0, 8);
}
