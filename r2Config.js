import { S3Client } from "@aws-sdk/client-s3";
;
const ACCESS_KEY_ID = "1532aa020719023cb1f6f30b930f4158";
const SECRET_ACCESS_KEY = "629cdafee9f0033770f64c05c796dde690948317c3225b46ef18a54ece33c58e";
const ENDPOINT = "https://502ee0d108979c6ff6d89119a5cd23e1.r2.cloudflarestorage.com"; 

export const s3Client = new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    credentials: {
        accessKeyId: "1532aa020719023cb1f6f30b930f4158",
        secretAccessKey: "629cdafee9f0033770f64c05c796dde690948317c3225b46ef18a54ece33c58e",
    },
});

export const R2_BUCKET_NAME = "my-social-app-bucket";
export const R2_PUBLIC_URL = "https://pub-8a179156e99f490e9839d113ac6c291d.r2.dev";