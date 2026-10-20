import { z } from 'zod'

// Khớp với validation phía server (Contracts/*.cs) để báo lỗi sớm; server vẫn là nơi kiểm tra cuối cùng.
export const phoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/

export const addressSchema = z.object({
  recipientName: z.string().trim().min(2, 'Vui lòng nhập tên người nhận').max(120),
  phone: z.string().trim().regex(phoneRegex, 'Số điện thoại không hợp lệ'),
  line1: z.string().trim().min(5, 'Vui lòng nhập số nhà, tên đường').max(255),
  ward: z.string().trim().max(100).optional(),
  district: z.string().trim().min(2, 'Vui lòng nhập quận/huyện').max(100),
  province: z.string().trim().min(2, 'Vui lòng nhập tỉnh/thành phố').max(100),
})

export const passwordSchema = z.string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(128)
  .regex(/[A-Z]/, 'Cần ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Cần ít nhất 1 chữ thường')
  .regex(/\d/, 'Cần ít nhất 1 chữ số')

export const optionalPhone = z.string().trim().refine(v => v === '' || phoneRegex.test(v), 'Số điện thoại không hợp lệ').optional()
