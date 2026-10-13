import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';

/**
 * SvelteKit 서버 엔드포인트: 로컬 개발 환경(웹 브라우저)에서 송신된 실적 엑셀 파일을 Download/receive 폴더에 기록합니다.
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { filename, data } = body;

    if (!filename || !data) {
      throw error(400, 'filename and data are required');
    }

    const directories = [
      path.resolve('Download/receive')
    ];

    const safeFilename = path.basename(filename);
    const fileBuffer = Buffer.from(data, 'base64');

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = path.join(dir, safeFilename);
      fs.writeFileSync(filePath, fileBuffer);
      console.log(`[Excel Receive API] Mock written file to local directory: ${filePath}`);
    }

    return json({ success: true, message: '실적 엑셀 파일이 성공적으로 기록되었습니다.' });
  } catch (err) {
    console.error('[Excel Receive API] POST error:', err);
    throw error(500, (err as Error).message || '파일을 쓰는 도중 에러가 발생했습니다.');
  }
};

