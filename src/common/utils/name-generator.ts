import { COUNTRY_NAMES_DB, CountryNames } from './country-names-data';

export interface GeneratedName {
  firstName: string;
  lastName: string;
  fullName: string;
}

export class NameGenerator {
  /**
   * Deterministic 32-bit PRNG (Mulberry32) from numeric seed, or random if undefined
   */
  private static getNextRandom(seed?: number): () => number {
    if (typeof seed === 'number' && !isNaN(seed)) {
      let a = (seed ^ 0x9e3779b9) >>> 0;
      return () => {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    return () => Math.random();
  }

  /**
   * Lấy cấu hình tên theo countryId (1..96, 101)
   */
  public static getCountryData(countryId: number): CountryNames {
    return COUNTRY_NAMES_DB[countryId] || COUNTRY_NAMES_DB[3]; // Fallback to England
  }

  /**
   * Sinh First Name & Last Name theo đúng quốc tịch và chuẩn văn hóa (hỗ trợ Họ đứng trước cho Á Đông)
   * @param countryId ID quốc gia trong DB
   * @param seed Tùy chọn: ID cầu thủ hoặc số nguyên để tạo tính nhất quán (deterministic)
   */
  public static generatePlayerName(countryId: number, seed?: number): GeneratedName {
    const data = this.getCountryData(countryId);
    const rng = this.getNextRandom(seed);

    const fIdx = Math.floor(rng() * data.firstNames.length);
    const lIdx = Math.floor(rng() * data.lastNames.length);

    if (data.isLastNameFirst) {
      // Đông Á (Việt Nam, Trung Quốc, Hàn Quốc...): Họ lưu ở firstName, Tên lưu ở lastName
      // để khi hệ thống hiển thị `${player.first_name} ${player.last_name}` sẽ ra đúng thứ tự Họ + Tên
      const familyName = data.lastNames[lIdx];
      const givenName = data.firstNames[fIdx];
      return {
        firstName: familyName,
        lastName: givenName,
        fullName: `${familyName} ${givenName}`
      };
    } else {
      // Phương Tây / Latinh: Tên (Given name) + Họ (Family name)
      const givenName = data.firstNames[fIdx];
      const familyName = data.lastNames[lIdx];
      return {
        firstName: givenName,
        lastName: familyName,
        fullName: `${givenName} ${familyName}`
      };
    }
  }

  /**
   * Sinh Họ và Tên cho Nhân viên (HLV, Trợ lý, Tuyển trạch viên, Bác sĩ) theo đúng quốc tịch
   */
  public static generateStaffName(countryId: number, seed?: number): string {
    const res = this.generatePlayerName(countryId, seed);
    return res.fullName;
  }
}
