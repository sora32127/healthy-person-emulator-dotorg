let _parquetBucket: R2Bucket | null = null;

export function initR2(bucket: R2Bucket) {
  _parquetBucket = bucket;
}

export function getParquetBucket(): R2Bucket {
  if (!_parquetBucket) throw new Error('R2 not initialized. Call initR2 first.');
  return _parquetBucket;
}

export async function generateDownloadSignedUrl(fileName: string): Promise<string> {
  // R2 binding does not support presigned URLs directly from Workers.
  // Serve files through a proxy route instead.
  return `/api/parquet/${fileName}`;
}
