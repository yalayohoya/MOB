import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { syncStore } from '$lib/stores/sync';
import { lang, t } from '$lib/stores/lang';
import { PUBLIC_APP_VERSION } from '$lib/constants';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { fetchWithTimeout } from './apiHelper';

import { writable } from 'svelte/store';

export const isDownloadingApk = writable<boolean>(false);
export const downloadProgress = writable<number>(0);
export const downloadingFileName = writable<string>('');

export interface VersionResponse {
  apkUrl: string;
  apkName: string;
  versionName: string;
  versionCode: string;
}

/**
 * 버전 비교 함수
 * 서버에 올라와 있는 버전 정보와 내 앱 버전이 다르면(!=) 무조건 업데이트가 필요한 상태(true)로 판단합니다.
 */
export function isNewerVersion(currentVer: string, serverVer: string): boolean {
  if (!serverVer) return false;

  const cur = (currentVer || '').trim();
  const srv = (serverVer || '').trim();

  // 서버의 버전 문자열과 내 앱의 버전 문자열이 다르면 무조건 업데이트 대상!
  return cur !== srv;
}

/**
 * APK 다운로드 및 패키지 설치 진행
 */
export async function processApkDownloadAndInstall(
  versionInfo: VersionResponse,
  baseUrl: string
): Promise<void> {
  const currentLang = get(lang);
  const downloadPath = versionInfo.apkUrl || '/downloadApk';
  const downloadUrl = new URL(downloadPath, baseUrl).toString();
  const fileName = versionInfo.apkName || 'app-update.apk';

  try {
    // 1. 전역 전체 화면 커버 GUI 프로그래스 스토어 활성화
    downloadingFileName.set(fileName);
    downloadProgress.set(0);
    isDownloadingApk.set(true);

    const platform = Capacitor.getPlatform();

    // 2. 새 다운로드 시작 직전, 이전에 캐시 폴더에 남아있던 파일들 깔끔하게 사전 삭제
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Cache,
      }).catch(() => null);
    } catch (e) {
      // 기존 파일이 없는 경우 예외 무시
    }

    if (platform === 'web') {
      // 웹 브라우저 환경: fetch + ReadableStream 기반 실시간 퍼센트 다운로드
      const response = await fetch(downloadUrl);
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let loadedBytes = 0;

      if (totalBytes === 0) {
        downloadProgress.set(-1); // Content-Length가 없을 시 Indeterminate 애니메이션 바 가동
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          loadedBytes += value.length;

          if (totalBytes > 0) {
            const percent = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
            downloadProgress.set(percent);
          }
        }
      }

      downloadProgress.set(100);
      const blob = new Blob(chunks as unknown as BlobPart[], { type: 'application/vnd.android.package-archive' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      // 전체 화면 커버 종료
      isDownloadingApk.set(false);
      await syncStore.showSyncAlert(
        t[currentLang].updateDownloadStartTitle,
        t[currentLang].updateDownloadStartMsg.replace('{filename}', fileName),
        'success'
      );
      return;
    }

    // 4. 안드로이드 스마트폰 네이티브 환경: Filesystem.downloadFile 사용 (OOM 튕김 100% 방지)
    // 네이티브 백그라운드 스트리밍 다운로드로 메모리 부족 현상 차단
    downloadProgress.set(-1); // Indeterminate 애니메이션 가동
    const downloadResult = await Filesystem.downloadFile({
      url: downloadUrl,
      path: fileName,
      directory: Directory.Cache,
    });

    downloadProgress.set(100);
    // 전체 화면 커버 종료
    isDownloadingApk.set(false);

    if (downloadResult && downloadResult.path) {
      // @capawesome-team/capacitor-file-opener를 이용하여 안드로이드 시스템 패키지 설치 화면 오픈
      await FileOpener.openFile({
        path: downloadResult.path,
        mimeType: 'application/vnd.android.package-archive',
      });
    }
  } catch (err: any) {
    console.error('[Update Service] APK Download Error:', err);
    isDownloadingApk.set(false);
    await syncStore.showSyncAlert(
      t[currentLang].updateDownloadErrorTitle,
      t[currentLang].updateDownloadErrorMsg.replace('{message}', err?.message || String(err)),
      'error'
    );
  }
}

/**
 * 서버 핑/헬스체크 함수 (HTTP/Capacitor 샌드박스 안전 타임아웃 핑)
 * 브라우저와 안드로이드 단말기 공통으로 빠른 핑 응답을 확인합니다.
 */
export async function checkServerPing(baseUrl: string, timeoutMs: number = 2500): Promise<boolean> {
  if (!baseUrl) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // HEAD 요청 시 서버가 살아있으면 200/404/500에 관계없이 HTTP 응답(res)이 돌아옵니다.
    const res = await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    // 서버가 아예 죽어있거나 네트워크 단절 시에만 res가 null이 됩니다.
    // 따라서 res !== null 이면 서버가 통신 가능한 상태(true)입니다.
    return res !== null;
  } catch (e) {
    return false;
  }
}

/**
 * 서버에 버전 정보를 확인하고 업데이트가 필요한 경우 설치 confirm 및 처리 프로세스를 진행합니다.
 */
export async function checkForUpdate(
  isManual: boolean = false,
  overrideBaseUrl?: string,
  overrideVersionApi?: string
): Promise<boolean> {
  const currentSettings = get(settings);
  const currentLang = get(lang);

  const targetBaseUrl = (overrideBaseUrl !== undefined ? overrideBaseUrl : currentSettings.baseUrl) || '';
  const targetVersionApi = (overrideVersionApi !== undefined ? overrideVersionApi : currentSettings.versionApi) || '/EAM/mob/version';

  if (!targetBaseUrl) {
    if (isManual) {
      await syncStore.showSyncAlert(
        t[currentLang].updateConfigErrorTitle,
        t[currentLang].updateConfigErrorMsg,
        'warning'
      );
    }
    return false;
  }

  const fullUrl = new URL(targetVersionApi, targetBaseUrl).toString();

  try {
    const response = await fetchWithTimeout(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      timeout: 5000,
    });

    if (!response.ok) {
      if (isManual) {
        await syncStore.showSyncAlert(
          t[currentLang].updateFetchErrorTitle,
          t[currentLang].updateFetchErrorMsg.replace('{status}', String(response.status)),
          'error'
        );
      }
      return false;
    }

    const data: VersionResponse = await response.json();
    const currentVer = PUBLIC_APP_VERSION || '1.0';

    const hasNewVersion = isNewerVersion(currentVer, data.versionName || data.versionCode);

    if (hasNewVersion) {
      const userConfirm = await syncStore.showSyncConfirm(
        t[currentLang].updateNoticeTitle,
        t[currentLang].updateNoticeMsg
          .replace('{serverVer}', data.versionName || data.versionCode)
          .replace('{currentVer}', currentVer)
      );

      if (userConfirm.confirmed) {
        await processApkDownloadAndInstall(data, targetBaseUrl);
        return true;
      }
    } else if (isManual) {
      await syncStore.showSyncAlert(
        t[currentLang].updateLatestTitle,
        t[currentLang].updateLatestMsg.replace('{version}', currentVer),
        'success'
      );
    }
  } catch (error: any) {
    console.error('[Update Service] Version check failed:', error);
    if (isManual) {
      const isNetworkError = error?.message?.includes('Failed to fetch') || error?.name === 'TypeError';
      const errorTitle = isNetworkError
        ? t[currentLang].updateConnectionErrorTitle
        : t[currentLang].updateCheckErrorTitle;

      const errorMsg = isNetworkError
        ? t[currentLang].updateConnectionErrorMsg
        : t[currentLang].updateCheckErrorMsg.replace('{message}', error?.message || String(error));

      await syncStore.showSyncAlert(errorTitle, errorMsg, 'error');
    }
  }

  return false;
}
