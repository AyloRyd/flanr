# osmium-tool for filtering and exporting OpenStreetMap extracts.
# Debian ships it as an official package, so nobody needs to build it or install it from AUR.
FROM debian:trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends osmium-tool \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /data
ENTRYPOINT ["osmium"]
