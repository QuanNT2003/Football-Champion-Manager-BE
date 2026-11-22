/** MySQL DATE/TIME carry game-server wall time, not UTC instants. */
export const GAME_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const LEAGUE_KICKOFF_SLOTS = ['19:00', '19:30', '20:00', '20:30', '21:00'];
export const CUP_KICKOFF_SLOTS = ['10:00', '10:30', '11:00', '11:30', '12:00'];
export const YOUTH_KICKOFF_SLOTS = ['17:00'];

// One representative IANA zone per national competition, also used for continental hosts.
// Countries with multiple zones use this national default until a venue zone is available.
// Reference: https://data.iana.org/time-zones/tzdb/zone1970.tab
export const COUNTRY_TIME_ZONES: Readonly<Record<string, string>> = {
  FRA: 'Europe/Paris', ESP: 'Europe/Madrid', ENG: 'Europe/London',
  BEL: 'Europe/Brussels', NED: 'Europe/Amsterdam', POR: 'Europe/Lisbon',
  ITA: 'Europe/Rome', CRO: 'Europe/Zagreb', GER: 'Europe/Berlin',
  SUI: 'Europe/Zurich', DEN: 'Europe/Copenhagen', AUT: 'Europe/Vienna',
  UKR: 'Europe/Kyiv', TUR: 'Europe/Istanbul', SWE: 'Europe/Stockholm',
  POL: 'Europe/Warsaw', RUS: 'Europe/Moscow', NOR: 'Europe/Oslo',
  WAL: 'Europe/London', SCO: 'Europe/London', CZE: 'Europe/Prague',
  GRE: 'Europe/Athens', SRB: 'Europe/Belgrade', ROU: 'Europe/Bucharest',
  SVK: 'Europe/Bratislava', SVN: 'Europe/Ljubljana', IRL: 'Europe/Dublin',
  FIN: 'Europe/Helsinki', HUN: 'Europe/Budapest', GEO: 'Asia/Tbilisi',
  ALB: 'Europe/Tirane', ISL: 'Atlantic/Reykjavik',
  ARG: 'America/Argentina/Buenos_Aires', BRA: 'America/Sao_Paulo',
  COL: 'America/Bogota', URU: 'America/Montevideo', ECU: 'America/Guayaquil',
  CHI: 'America/Santiago', PAR: 'America/Asuncion', BOL: 'America/La_Paz',
  USA: 'America/New_York', MEX: 'America/Mexico_City', CAN: 'America/Toronto',
  PAN: 'America/Panama', CRC: 'America/Costa_Rica', JAM: 'America/Jamaica',
  HON: 'America/Tegucigalpa', SLV: 'America/El_Salvador',
  JPN: 'Asia/Tokyo', IRN: 'Asia/Tehran', KOR: 'Asia/Seoul', AUS: 'Australia/Sydney',
  QAT: 'Asia/Qatar', KSA: 'Asia/Riyadh', UZB: 'Asia/Tashkent', IRQ: 'Asia/Baghdad',
  JOR: 'Asia/Amman', UAE: 'Asia/Dubai', OMA: 'Asia/Muscat', BHR: 'Asia/Bahrain',
  CHN: 'Asia/Shanghai', SYR: 'Asia/Damascus', PLE: 'Asia/Hebron',
  THA: 'Asia/Bangkok', VIE: GAME_TIME_ZONE, PRK: 'Asia/Pyongyang',
  TJK: 'Asia/Dushanbe', LBN: 'Asia/Beirut', IND: 'Asia/Kolkata',
  MAS: 'Asia/Kuala_Lumpur', IDN: 'Asia/Jakarta', PHI: 'Asia/Manila',
  TKM: 'Asia/Ashgabat', KUW: 'Asia/Kuwait', YEM: 'Asia/Aden',
  SIN: 'Asia/Singapore', MYA: 'Asia/Yangon', HKG: 'Asia/Hong_Kong',
  KGZ: 'Asia/Bishkek', CAM: 'Asia/Phnom_Penh',
  MAR: 'Africa/Casablanca', SEN: 'Africa/Dakar', EGY: 'Africa/Cairo',
  NGA: 'Africa/Lagos', CIV: 'Africa/Abidjan', CMR: 'Africa/Douala',
  ALG: 'Africa/Algiers', TUN: 'Africa/Tunis', MLI: 'Africa/Bamako',
  RSA: 'Africa/Johannesburg', GHA: 'Africa/Accra', BFA: 'Africa/Ouagadougou',
  CPV: 'Atlantic/Cape_Verde', GUI: 'Africa/Conakry', GAB: 'Africa/Libreville',
  BEN: 'Africa/Porto-Novo',
  CHL: 'America/Santiago', VNM: GAME_TIME_ZONE, NZL: 'Pacific/Auckland',
};

const formatters = new Map<string, Intl.DateTimeFormat>();
function wallClockTimestamp(date: Date, timeZone: string): number {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function getMatchScheduleFromLocalSlot(
  slots: readonly string[],
  slotSeed: number,
  country: { code?: string | null } | null | undefined,
  localDate: Date,
): { match_date: Date; kickoff_time: Date } {
  const code = country?.code?.trim().toUpperCase();
  const timeZone = COUNTRY_TIME_ZONES[code];
  if (!timeZone) throw new Error(`Missing match timezone for country: ${code || '(unknown)'}`);
  if (!slots.length || !Number.isSafeInteger(slotSeed) || Number.isNaN(localDate.getTime())) {
    throw new Error('Invalid kickoff slots, seed or local match date');
  }
  const slot = slots[Math.abs(slotSeed) % slots.length];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot)) throw new Error(`Invalid kickoff slot: ${slot}`);
  const [hour, minute] = slot.split(':').map(Number);
  const target = Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), hour, minute);
  let instant = target;
  // Resolve the real offset on the fixture date, including DST and fractional hours.
  for (let attempt = 0; attempt < 4; attempt++) {
    const delta = target - wallClockTimestamp(new Date(instant), timeZone);
    if (delta === 0) break;
    instant += delta;
  }
  if (wallClockTimestamp(new Date(instant), timeZone) !== target) {
    throw new Error(`Nonexistent local kickoff: ${localDate.toISOString().slice(0, 10)} ${slot} ${timeZone}`);
  }
  const serverClock = new Date(wallClockTimestamp(new Date(instant), GAME_TIME_ZONE));
  return {
    match_date: new Date(Date.UTC(serverClock.getUTCFullYear(), serverClock.getUTCMonth(), serverClock.getUTCDate())),
    // Prisma's epoch date is only a TIME carrier. It must not be converted as a 1970 instant.
    kickoff_time: new Date(Date.UTC(1970, 0, 1, serverClock.getUTCHours(), serverClock.getUTCMinutes())),
  };
}

export function formatKickoffTime(time: Date | null | undefined, fallback = '--:--'): string {
  return time && !Number.isNaN(time.getTime()) ? time.toISOString().slice(11, 16) : fallback;
}
