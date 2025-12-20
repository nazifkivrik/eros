#!/bin/sh

# Eğer /data klasörü root'a aitse veya yazma izni yoksa sahipliği node kullanıcısına ver
# Not: Node imajlarında genelde 'node' kullanıcısı UID 1000'dir.
chown -R node:node /data
chown -R node:node /app/media

# Asıl komutu çalıştır (CMD'den gelen komut)
# 'su-exec' veya 'gosu' kullanarak root yetkisinden node kullanıcısına geçiş yapılır
exec su-exec node "$@"