#!/usr/bin/env python3
"""Backup 06 silk-scarf generated assets to S3 (durable, survives GPU terminate / local disk loss).
Uploads ltx_mp4/*.mp4 and out/*_first.png,*_last.png to s3://cdh-ingest-demo/showcase-ltx/06-silk-scarf/."""
import os, sys, glob
import boto3

BUCKET = "cdh-ingest-demo"
PREFIX = "showcase-ltx/06-silk-scarf"
HERE = os.path.dirname(os.path.abspath(__file__))
REGION = os.environ.get("AWS_REGION", "us-west-2")

s3 = boto3.client("s3", region_name=REGION)

def upload(local, key, ctype):
    s3.upload_file(local, BUCKET, key, ExtraArgs={"ContentType": ctype})
    print(f"  OK  s3://{BUCKET}/{key}")

def main():
    only = set(sys.argv[1:])  # optional: restrict to given shot ids
    n = 0
    for mp4 in sorted(glob.glob(os.path.join(HERE, "ltx_mp4", "*.mp4"))):
        sid = os.path.splitext(os.path.basename(mp4))[0]
        if only and sid not in only:
            continue
        upload(mp4, f"{PREFIX}/mp4/{sid}.mp4", "video/mp4")
        n += 1
    for png in sorted(glob.glob(os.path.join(HERE, "out", "*_first.png")) +
                      glob.glob(os.path.join(HERE, "out", "*_last.png"))):
        base = os.path.basename(png)
        sid = base.replace("_first.png", "").replace("_last.png", "")
        if only and sid not in only:
            continue
        upload(png, f"{PREFIX}/frames/{base}", "image/png")
        n += 1
    print(f"DONE: {n} objects uploaded to s3://{BUCKET}/{PREFIX}/")

if __name__ == "__main__":
    main()
