#!/usr/bin/env python3
"""Publish rendered films to the showcase gallery (S3 + CloudFront).

Usage: publish_gallery.py <scene_dir> [<scene_dir> ...]
  scene_dir = path to e.g. .../opus-5.5/03-perfume

Uploads <scene>/out/* (films, covers, sidecars, index.json) plus the scene's
meta.js and js/*.js (so the live interactive page matches the films), then
creates one CloudFront invalidation covering /<scene>/*.
"""
import mimetypes
import os
import sys
import time

import boto3

BUCKET = 'opus55-showcase-gallery-747411437379'
DIST = 'E2OWHD5QDJ1TN9'
CT = {'.mp4': 'video/mp4', '.json': 'application/json', '.js': 'text/javascript',
      '.jpg': 'image/jpeg', '.png': 'image/png', '.vtt': 'text/vtt', '.srt': 'text/plain'}


def files_for(scene):
    out = os.path.join(scene, 'out')
    for name in sorted(os.listdir(out)):
        p = os.path.join(out, name)
        if os.path.isfile(p):
            yield p, f'out/{name}'
    for rel in ['meta.js'] + [f'js/{n}' for n in sorted(os.listdir(os.path.join(scene, 'js')))]:
        p = os.path.join(scene, rel)
        if os.path.isfile(p):
            yield p, rel


def main(scenes):
    s3 = boto3.client('s3', region_name='us-east-1')
    paths = []
    for scene in scenes:
        scene = os.path.abspath(scene)
        sid = os.path.basename(scene)
        n = 0
        for local, rel in files_for(scene):
            ext = os.path.splitext(local)[1].lower()
            ctype = CT.get(ext) or mimetypes.guess_type(local)[0] or 'application/octet-stream'
            s3.upload_file(local, BUCKET, f'{sid}/{rel}', ExtraArgs={'ContentType': ctype})
            n += 1
        print(f'{sid}: uploaded {n} objects')
        paths.append(f'/{sid}/*')
    cf = boto3.client('cloudfront')
    r = cf.create_invalidation(DistributionId=DIST, InvalidationBatch={
        'Paths': {'Quantity': len(paths), 'Items': paths},
        'CallerReference': f'publish-{int(time.time())}'})
    inv = r['Invalidation']
    print(f"invalidation {inv['Id']} {inv['Status']} {paths}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
