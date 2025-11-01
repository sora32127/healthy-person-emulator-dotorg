import { Storage } from '@google-cloud/storage';

type Environment = 'production' | 'development';

/**
 * ファイルの署名付きダウンロードURLを生成
 * @param fileName ファイル名
 * @param expirationMinutes 有効期限（分）
 * @returns 署名付きURL
 */
export async function generateDownloadSignedUrl(
  fileName: string,
  expirationMinutes: number = 15
): Promise<string> {
  if (fileName.startsWith('gcs-demo-')) {
    return `http://localhost:3000/parquet/${fileName}`;
  }

  try {
    // Cloud Run環境ではApplication Default Credentialsを使用
    // ローカル環境では環境変数またはキーファイルで認証
    const env = getEnvironment();
    const storage = env === 'production' 
      ? new Storage() // ADCを使用（Cloud Run環境）
      : new Storage({
          keyFilename: "./hpe-temp-downloader-key.json"
        }); // ローカル環境用
    
    const bucket = storage.bucket("hpe-temp");
    const file = bucket.file(fileName);

    // ファイルの存在確認
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File ${fileName} does not exist in bucket hpe-temp`);
    }

    // 署名付きURLを生成
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expirationMinutes * 60 * 1000,
    });

    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL for ${fileName}`);
  }
}

function getEnvironment(): Environment {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}   