export function formatVietnameseDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatVietnameseDateTime(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortChartDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function calculateAgeFromBirthYear(birthYear: number): number {
  const currentYear = new Date().getFullYear();
  return Math.max(0, currentYear - birthYear);
}

/**
 * Tính tuổi chính xác theo ngày sinh (YYYY-MM-DD) tại thời điểm tham chiếu.
 * Trả về null nếu chuỗi ngày sinh không hợp lệ hoặc nằm trong tương lai.
 */
export function calculateAgeFromBirthDate(
  birthDateStr: string,
  referenceDate: Date = new Date()
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(year, month - 1, day);
  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return null;
  }
  if (dob.getTime() > referenceDate.getTime()) {
    return null;
  }
  let age = referenceDate.getFullYear() - year;
  const monthDiff = referenceDate.getMonth() - (month - 1);
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < day)
  ) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey(): string {
  return formatLocalDateKey(new Date());
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return formatLocalDateKey(dt);
}

export function formatDisplayDateKeyVi(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return formatVietnameseDate(new Date(y, m - 1, d));
}
