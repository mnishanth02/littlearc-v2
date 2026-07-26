# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:26.4.0-bookworm-slim@sha256:ec82d089a8ae2cf02628da7b34ea57dc357b24db724d557fe2d240e6beb659c1
FROM ${NODE_IMAGE} AS native-builder

ARG LIBVIPS_VERSION=8.17.3
ARG LIBVIPS_SHA256=41e9a1439cd57dcc6d4435a085e2cfe181d9da1962fa84a484f09e8b536e4b77
ARG LIBHEIF_VERSION=1.15.1-1+deb12u1
ARG LIBDE265_VERSION=1.0.11-1+deb12u2
ARG LIBX265_VERSION=3.5-2+b1
ARG LIBJPEG_VERSION=1:2.1.5-2
ARG LIBPNG_VERSION=1.6.39-2+deb12u5

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    libde265-dev=${LIBDE265_VERSION} \
    libexpat1-dev \
    libglib2.0-dev \
    libheif-dev=${LIBHEIF_VERSION} \
    libjpeg62-turbo-dev=${LIBJPEG_VERSION} \
    libpng-dev=${LIBPNG_VERSION} \
    libx265-dev=${LIBX265_VERSION} \
    meson \
    ninja-build \
    pkgconf \
    unzip \
  && curl --fail --location --silent --show-error \
    "https://github.com/libvips/libvips/releases/download/v${LIBVIPS_VERSION}/vips-${LIBVIPS_VERSION}.tar.xz" \
    --output /tmp/libvips.tar.xz \
  && echo "${LIBVIPS_SHA256}  /tmp/libvips.tar.xz" | sha256sum --check --strict \
  && mkdir /tmp/libvips \
  && tar --extract --xz --file /tmp/libvips.tar.xz --directory /tmp/libvips --strip-components=1 \
  && meson setup /tmp/libvips/build /tmp/libvips \
    --buildtype=release \
    --prefix=/usr/local \
    --libdir=lib \
    -Danalyze=false \
    -Darchive=disabled \
    -Dcfitsio=disabled \
    -Dcgif=disabled \
    -Dcplusplus=true \
    -Ddeprecated=false \
    -Dexamples=false \
    -Dexif=disabled \
    -Dfftw=disabled \
    -Dfontconfig=disabled \
    -Dheif=enabled \
    -Dheif-module=disabled \
    -Dhighway=disabled \
    -Dimagequant=disabled \
    -Dintrospection=disabled \
    -Djpeg=enabled \
    -Djpeg-xl=disabled \
    -Dlcms=disabled \
    -Dmagick=disabled \
    -Dmatio=disabled \
    -Dmodules=disabled \
    -Dnifti=disabled \
    -Dnsgif=false \
    -Dopenexr=disabled \
    -Dopenjpeg=disabled \
    -Dopenslide=disabled \
    -Dorc=disabled \
    -Dpangocairo=disabled \
    -Dpdfium=disabled \
    -Dpng=enabled \
    -Dpoppler=disabled \
    -Dppm=false \
    -Dquantizr=disabled \
    -Dradiance=false \
    -Drsvg=disabled \
    -Dspng=disabled \
    -Dtiff=disabled \
    -Dwebp=disabled \
    -Dzlib=enabled \
  && ninja -C /tmp/libvips/build install \
  && pkg-config --modversion vips-cpp \
  && ldconfig \
  && /usr/local/bin/vips black /tmp/littlearc-synthetic.v 2 2 --bands 3 \
  && /usr/local/bin/vips copy /tmp/littlearc-synthetic.v \
    "/tmp/littlearc-synthetic.heic[compression=hevc,lossless=true]"

FROM native-builder AS application-builder
WORKDIR /app
ENV SHARP_FORCE_GLOBAL_LIBVIPS=1
ENV npm_config_build_from_source=true
COPY . .
RUN npm install --global pnpm@11.14.0 \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @littlearc/worker exec npm explore sharp -- npm run build \
  && make --directory apps/worker/node_modules/sharp/src/build \
  && (cd apps/worker && FILE_VALIDATION_ENABLED=true node ../../tooling/file-validation/install-qpdf.mjs) \
  && pnpm --filter @littlearc/worker... build \
  && node -e "const sharp=require('./apps/worker/node_modules/sharp'); if(sharp.versions.sharp!=='0.34.5'||sharp.versions.vips!=='8.17.3'||!sharp.format.heif.input.file){process.exit(1)}"

FROM ${NODE_IMAGE} AS runtime

ARG LIBHEIF_VERSION=1.15.1-1+deb12u1
ARG LIBDE265_VERSION=1.0.11-1+deb12u2
ARG LIBX265_VERSION=3.5-2+b1
ARG LIBJPEG_VERSION=1:2.1.5-2
ARG LIBPNG_VERSION=1.6.39-2+deb12u5
ARG POPPLER_VERSION=22.12.0-2+deb12u2
RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    libde265-0=${LIBDE265_VERSION} \
    libexpat1 \
    libglib2.0-0 \
    libheif1=${LIBHEIF_VERSION} \
    libjpeg62-turbo=${LIBJPEG_VERSION} \
    libpng16-16=${LIBPNG_VERSION} \
    libatomic1 \
    libx265-199=${LIBX265_VERSION} \
    poppler-utils=${POPPLER_VERSION} \
    util-linux \
  && apt-get clean

COPY --from=native-builder /usr/local/lib/ /usr/local/lib/
COPY --from=application-builder /app /app
COPY --from=native-builder /tmp/littlearc-synthetic.heic /opt/littlearc/synthetic-validation.heic
RUN ldconfig \
  && useradd --create-home --uid 55105 --user-group --shell /usr/sbin/nologin littlearc \
  && chown --recursive littlearc:littlearc /app/apps/worker/.tools \
  && setpriv --reuid=littlearc --regid=littlearc --init-groups --no-new-privs \
    /usr/bin/prlimit --as=4294967296 --cpu=30 --fsize=16777216 --nofile=64 --nproc=64 -- \
    /usr/local/bin/node --max-old-space-size=256 --max-semi-space-size=16 \
    /app/apps/worker/dist/file-validation/heic-decoder-child.js --probe \
    | grep --fixed-strings \
      '"capability":{"heif":"system","sharp":"0.34.5","vips":"8.17.3"}'
RUN setpriv --reuid=littlearc --regid=littlearc --init-groups --no-new-privs \
    /usr/bin/prlimit --as=4294967296 --cpu=30 --fsize=16777216 --nofile=64 --nproc=64 -- \
    /usr/local/bin/node --max-old-space-size=256 --max-semi-space-size=16 \
    /app/apps/worker/dist/file-preview/renderer-child.js --probe \
    | grep --fixed-strings \
      '"capability":{"heif":"system","jpeg":true,"png":true,"sharp":"0.34.5","vips":"8.17.3"}'

WORKDIR /app
ENV APP_ENV=staging
ENV FILE_PREVIEWS_ENABLED=false
ENV PDFTOPPM_EXECUTABLE=/usr/bin/pdftoppm
ENV LD_LIBRARY_PATH=/usr/local/lib
ENV NODE_ENV=production
ENV SHARP_FORCE_GLOBAL_LIBVIPS=1
USER littlearc
CMD ["node", "apps/worker/dist/index.js"]
