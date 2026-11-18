#!/usr/bin/env node
/**
 * Script CLI cục bộ để cấp hoặc thu hồi quyền quản trị viên (`admin: true`)
 * qua Firebase Custom Claims cho một tài khoản theo email.
 *
 * Yêu cầu bảo mật:
 * - Không bao giờ lưu tệp service account JSON vào git.
 * - Truyền đường dẫn tệp qua biến môi trường FIREBASE_SERVICE_ACCOUNT_PATH
 *   hoặc GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Ví dụ:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/service-account.json \
 *     node scripts/set-admin-claim.mjs --email admin@example.com
 *
 * Thu hồi quyền:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/service-account.json \
 *     node scripts/set-admin-claim.mjs --email admin@example.com --revoke
 */
/* global console */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function printUsage() {
  console.log(`
Cách dùng:
  FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/service-account.json \\
    node scripts/set-admin-claim.mjs --email <email-nguoi-dung> [--revoke]

Tùy chọn:
  --email <email>   Email của tài khoản đã đăng ký trong Firebase Authentication
  --revoke          Thu hồi quyền admin (đặt admin = false)
  --help            Hiển thị hướng dẫn này
`);
}

function parseArgs(argv) {
  let email = '';
  let revoke = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--revoke') {
      revoke = true;
    } else if (arg === '--email') {
      email = (argv[i + 1] ?? '').trim();
      i += 1;
    } else if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length).trim();
    }
  }

  return { email, revoke, help };
}

async function main() {
  const { email, revoke, help } = parseArgs(process.argv.slice(2));

  if (help) {
    printUsage();
    process.exit(0);
  }

  if (!email || !email.includes('@')) {
    console.error('Lỗi: Vui lòng cung cấp email hợp lệ qua tham số --email.');
    printUsage();
    process.exit(1);
  }

  const serviceAccountEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!serviceAccountEnv) {
    console.error(
      'Lỗi: Chưa thiết lập biến môi trường FIREBASE_SERVICE_ACCOUNT_PATH hoặc GOOGLE_APPLICATION_CREDENTIALS.'
    );
    console.error(
      'Hãy tải khóa service account từ Firebase Console -> Project Settings -> Service accounts, lưu ở thư mục bị gitignore (ví dụ ./secrets/service-account.json), rồi chạy lại lệnh.'
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), serviceAccountEnv);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Lỗi: Không tìm thấy tệp service account tại: ${resolvedPath}`);
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    console.error('Lỗi: Không thể đọc hoặc phân tích JSON của tệp service account.', err);
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const existingClaims = user.customClaims ?? {};

  const nextClaims = { ...existingClaims };
  if (revoke) {
    delete nextClaims.admin;
  } else {
    nextClaims.admin = true;
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);

  if (revoke) {
    console.log(`Đã thu hồi quyền admin cho tài khoản ${user.email} (UID: ${user.uid}).`);
  } else {
    console.log(`Đã cấp quyền admin (admin: true) cho tài khoản ${user.email} (UID: ${user.uid}).`);
  }

  console.log(
    'Lưu ý quan trọng: Người dùng cần ĐĂNG XUẤT và ĐĂNG NHẬP LẠI trên trình duyệt (hoặc đợi làm mới ID token) để quyền mới có hiệu lực ở cả ứng dụng và Firestore Security Rules.'
  );
}

main().catch((err) => {
  console.error('Thực thi thất bại:', err instanceof Error ? err.message : err);
  process.exit(1);
});
