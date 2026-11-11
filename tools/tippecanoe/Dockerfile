# tippecanoe builds vector tiles (PMTiles) from GeoJSON.
# Debian ships it as an official package, so nobody needs to build it from source.
FROM debian:trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends tippecanoe \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /data
ENTRYPOINT ["tippecanoe"]
