import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';

/**
 * SvelteKit 서버 엔드포인트: 로컬 개발 환경(웹 브라우저)에서 xlsx_sample 디렉토리의 파일 목록 조회 및 바이너리 다운로드를 수행합니다.
 */
export const GET: RequestHandler = async ({ url }) => {
  const fileParam = url.searchParams.get('file');
  const prefix = url.searchParams.get('prefix') || '';
  
  // 프로젝트 루트의 Download/send 경로
  const sampleDir = path.resolve('Download/send');

  // 1. 특정 엑셀 파일의 바이너리 내용 요청 처리
  if (fileParam) {
    // 디렉토리 트래버설 공격 방지를 위한 보안 처리
    const safeFilename = path.basename(fileParam);
    const filePath = path.join(sampleDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw error(404, '지정된 엑셀 파일을 찾을 수 없습니다.');
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}"`
        }
      });
    } catch (err) {
      console.error('[Excel API] File read error:', err);
      throw error(500, '파일을 읽어들이는 도중 에러가 발생했습니다.');
    }
  }

  // 2. 디렉토리 내 파일 목록 요청 처리 (Prefix 필터 포함)
  if (!fs.existsSync(sampleDir)) {
    return json([]);
  }

  try {
    const files = fs.readdirSync(sampleDir);
    const filteredFiles = files
      .filter(filename => filename.startsWith(prefix) && (filename.endsWith('.xlsx') || filename.endsWith('.xls')))
      .map(filename => {
        const filePath = path.join(sampleDir, filename);
        const stats = fs.statSync(filePath);
        
        // 파일명 끝부분의 타임스탬프 추출 시도 (예: Inspector Info1778712808044.xlsx)
        const match = filename.match(/(\d+)\.(xlsx|xls)$/);
        const timestamp = match ? parseInt(match[1]) : stats.mtimeMs;

        return {
          filename,
          size: stats.size,
          timestamp,
          formattedDate: new Date(timestamp).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })
        };
      })
      // 최신 파일(타임스탬프가 큰 값)이 최상단에 오도록 정렬
      .sort((a, b) => b.timestamp - a.timestamp);

    return json(filteredFiles);
  } catch (err) {
    console.error('[Excel API] Directory scanning error:', err);
    return json([]);
  }
};

/**
 * SvelteKit 서버 엔드포인트: 로컬 개발 환경(웹 브라우저)에서 엑셀 파일 삭제를 수행합니다.
 */
export const DELETE: RequestHandler = async ({ url }) => {
  const fileParam = url.searchParams.get('file');
  if (!fileParam) {
    throw error(400, '삭제할 파일명이 지정되지 않았습니다.');
  }

  const sampleDir = path.resolve('Download/send');
  const safeFilename = path.basename(fileParam);
  const filePath = path.join(sampleDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    throw error(404, '지정된 파일을 찾을 수 없습니다.');
  }

  try {
    fs.unlinkSync(filePath);
    return json({ success: true, message: '파일이 성공적으로 삭제되었습니다.' });
  } catch (err) {
    console.error('[Excel API] File delete error:', err);
    throw error(500, '파일을 삭제하는 도중 에러가 발생했습니다.');
  }
};
