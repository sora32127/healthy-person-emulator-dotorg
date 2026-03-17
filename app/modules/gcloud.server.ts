/**
 * GCS Parquetファイルの配信
 * Workers移行後はGCS SDKが使えないため、署名付きURLではなく
 * 環境変数で指定されたベースURLからファイルを配信する。
 * 将来的にR2に完全移行予定。
 */

let _baseUrl: string | null = null;

export function initGcloud(baseUrl: string) {
  _baseUrl = baseUrl;
}

export async function generateDownloadSignedUrl(
  fileName: string,
  _expirationMinutes: number = 15,
): Promise<string> {
  if (fileName.startsWith('gcs-demo-')) {
    return `http://localhost:3000/parquet/${fileName}`;
  }

  if (!_baseUrl) {
    throw new Error('GCS base URL not initialized. Call initGcloud first.');
  }

  return `${_baseUrl}/${fileName}`;
}
