/**
 * Chuẩn hóa chuỗi tiếng Việt để tìm kiếm không phân biệt dấu:
 * chuyển chữ thường, đổi đ/Đ -> d, loại bỏ dấu thanh/mũ Unicode, cắt khoảng trắng thừa.
 */
export function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tạo slug ID ổn định từ tên món ăn (ví dụ "Phở bò" -> "pho-bo").
 */
export function slugifyFoodId(text: string): string {
  return normalizeVietnamese(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
}
