import { FACEPACK_DATA } from './facepack-data';

export interface CountryFacepackInfo {
  countryId: number;
  countryCode: string;
  countryName: string;
  folder: string;
  prefix: string;
  numbers: readonly number[];
  staffRegion: string;
}

export interface StaffRegionInfo {
  region: string;
  totalCount: number;
}

export class AvatarGenerator {
  private static readonly data = FACEPACK_DATA as {
    countries: Record<number, CountryFacepackInfo>;
    staffRegions: Record<string, StaffRegionInfo>;
  };

  /**
   * Deterministic 32-bit PRNG (Mulberry32) from numeric seed, or Math.random if undefined
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
   * Sinh đường dẫn ảnh đại diện cho Cầu thủ theo đúng Quốc tịch
   * @param countryId ID quốc gia trong DB (1..96)
   * @param seed Tùy chọn: ID cầu thủ hoặc số nguyên để tạo tính nhất quán (deterministic)
   * @returns Đường dẫn ảnh (ví dụ: '/facepack/Vietnam/VIE85.png')
   */
  public static generatePlayerAvatar(countryId: number, seed?: number): string {
    const countryInfo = this.data.countries[countryId] || this.data.countries[3]; // Fallback: England (id 3)
    if (!countryInfo || !countryInfo.numbers || countryInfo.numbers.length === 0) {
      return '/assets/players/default.png';
    }

    const rng = this.getNextRandom(seed);
    const idx = Math.floor(rng() * countryInfo.numbers.length);
    const picNum = countryInfo.numbers[idx];

    return `/facepack/${countryInfo.folder}/${countryInfo.prefix}${picNum}.png`;
  }

  /**
   * Sinh đường dẫn ảnh đại diện cho Nhân viên (HLV, Trợ lý, Tuyển trạch viên, Bác sĩ)
   * Hỗ trợ tạo ảnh từ kho 13 Staff Regions chuyên dụng (hơn 31,700 ảnh) hoặc từ folder Quốc gia
   * @param countryId ID quốc gia của Staff
   * @param seed Tùy chọn: ID staff hoặc số nguyên để deterministic
   * @param useStaffRegion Sử dụng ảnh kho chuyên dụng Staff Region (mặc định: true)
   * @returns Đường dẫn ảnh (ví dụ: '/facepack/Staff/Seasian/Seasian_Staff_42.png')
   */
  public static generateStaffAvatar(countryId: number, seed?: number, useStaffRegion = true): string {
    const countryInfo = this.data.countries[countryId] || this.data.countries[3];
    const rng = this.getNextRandom(seed);

    if (useStaffRegion && countryInfo && countryInfo.staffRegion) {
      const regionInfo = this.data.staffRegions[countryInfo.staffRegion];
      if (regionInfo && regionInfo.totalCount > 0) {
        const staffNum = Math.floor(rng() * regionInfo.totalCount) + 1;
        return `/facepack/Staff/${regionInfo.region}/${regionInfo.region}_Staff_${staffNum}.png`;
      }
    }

    // Fallback: Sử dụng ảnh theo folder quốc gia
    return this.generatePlayerAvatar(countryId, seed);
  }

  /**
   * Lấy danh sách thông tin facepack theo từng quốc gia
   */
  public static getCountryFacepackInfo(countryId: number): CountryFacepackInfo | undefined {
    return this.data.countries[countryId];
  }
}
