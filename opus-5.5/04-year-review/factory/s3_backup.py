#!/usr/bin/env python3
"""Backup 04-year-review rendered films to S3 (durable, survives GPU terminate / local disk loss).
Uploads out/*.mp4, out/*.jpg|png covers, out/*.json sidecars + index.json to
s3://cdh-ingest-demo/showcase/04-year-review/."""
import os, glob
import boto3

BUCKET = "cdh-ingest-demo"
PREFIX = "showcase/04-year-review"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "out")
REGION = os.environ.get("AWS_REGION", "ap-northeast-1")

s3 = boto3.client("s3", region_name=REGION)

CTYPE = {".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".png": "image/png", ".json": "application/json"}


def upload(local, key):
    ext = os.path.splitext(local)[1].lower()
    s3.upload_file(local, BUCKET, key, ExtraArgs={"ContentType": CTYPE.get(ext, "application/octet-stream")})
    print(f"  OK  s3://{BUCKET}/{key}")


def main():
    n = 0
    for p in sorted(glob.glob(os.path.join(OUT, "*"))):
        if not os.path.isfile(p):
            continue
        ext = os.path.splitext(p)[1].lower()
        if ext not in CTYPE:
            continue
        upload(p, f"{PREFIX}/{os.path.basename(p)}")
        n += 1
    print(f"DONE: {n} objects uploaded to s3://{BUCKET}/{PREFIX}/")


if __name__ == "__main__":
    main()
