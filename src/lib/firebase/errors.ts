import { FirebaseError } from 'firebase/app';
import { auth } from './config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatAuthErrorVi(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
      case 'auth/email-already-in-use':
        return 'Địa chỉ email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.';
      case 'auth/weak-password':
        return 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu tối thiểu 6 ký tự.';
      case 'auth/invalid-email':
        return 'Địa chỉ email không đúng định dạng.';
      case 'auth/too-many-requests':
        return 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.';
      case 'auth/popup-closed-by-user':
        return 'Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.';
      case 'auth/popup-blocked':
        return 'Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép pop-up để đăng nhập Google.';
      case 'auth/requires-recent-login':
        return 'Vì lý do bảo mật, bạn cần đăng nhập lại gần đây trước khi thực hiện thao tác xóa tài khoản.';
      case 'auth/network-request-failed':
        return 'Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại.';
      default:
        return `Đã xảy ra lỗi xác thực (${error.code}). Vui lòng thử lại.`;
    }
  }
  return 'Đã xảy ra lỗi không xác định trong quá trình xác thực.';
}

export function formatFirestoreUiErrorVi(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
    return 'Bạn không có quyền truy cập hoặc dữ liệu chưa đáp ứng điều kiện bảo mật (ví dụ: chưa đồng ý điều khoản xử lý dữ liệu).';
  }
  if (raw.includes('Quota exceeded')) {
    return 'Hệ thống đã chạm giới hạn truy cập miễn phí trong ngày. Vui lòng thử lại vào ngày mai.';
  }
  return 'Không thể đồng bộ dữ liệu với máy chủ. Vui lòng thử lại sau.';
}
