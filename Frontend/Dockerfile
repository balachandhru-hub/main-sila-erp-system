# -------------------------------------------------
# VOSOX Frontend – microfrontend (host + buyer + supplier + platform-user + mobile)
# -------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Module-federation remote URLs baked at build time. Override per-remote
# via --build-arg if subdomains change.
ARG VITE_REMOTE_BUYER_URL=https://vosox-buyer.chervicaon.com/assets/remoteEntry.js
ARG VITE_REMOTE_SUPPLIER_URL=https://vosox-supplier.chervicaon.com/assets/remoteEntry.js
ARG VITE_REMOTE_PLATFORM_USER_URL=https://vosox-platform-user.chervicaon.com/assets/remoteEntry.js
ARG VITE_REMOTE_MOBILE_URL=https://vosox-mobile.chervicaon.com/assets/remoteEntry.js
ENV VITE_REMOTE_BUYER_URL=${VITE_REMOTE_BUYER_URL}
ENV VITE_REMOTE_SUPPLIER_URL=${VITE_REMOTE_SUPPLIER_URL}
ENV VITE_REMOTE_PLATFORM_USER_URL=${VITE_REMOTE_PLATFORM_USER_URL}
ENV VITE_REMOTE_MOBILE_URL=${VITE_REMOTE_MOBILE_URL}

COPY package.json package-lock.json ./
COPY packages/host-app/package.json            packages/host-app/package.json
COPY packages/remote-buyer/package.json        packages/remote-buyer/package.json
COPY packages/remote-supplier/package.json     packages/remote-supplier/package.json
COPY packages/remote-platform-user/package.json packages/remote-platform-user/package.json
COPY packages/remote-mobile/package.json       packages/remote-mobile/package.json
COPY packages/shared-ui/package.json           packages/shared-ui/package.json

# npm's optional-dependency bug (npm/cli#4828) leaves Rollup's platform
# native binary (@rollup/rollup-linux-x64-musl on Alpine) uninstalled,
# breaking `vite build` with "Cannot find module @rollup/rollup-linux-x64-musl".
# Both `npm install` and `npm ci` reproduce it against the committed
# lockfile. The documented remedy (printed in the error itself) is to drop
# the lockfile and let npm resolve the correct platform binary fresh.
# Verified building all four remotes + host on the Alpine build image.
RUN rm -f package-lock.json && npm install --include=dev --legacy-peer-deps

COPY . .

RUN npm run build -w @vosox/shared-ui && \
    npm run build -w packages/remote-buyer && \
    npm run build -w packages/remote-supplier && \
    npm run build -w packages/remote-platform-user && \
    npm run build -w packages/remote-mobile && \
    npm run build -w packages/host-app

# -------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/packages/host-app/dist            /usr/share/nginx/host
COPY --from=build /app/packages/remote-buyer/dist        /usr/share/nginx/buyer
COPY --from=build /app/packages/remote-supplier/dist     /usr/share/nginx/supplier
COPY --from=build /app/packages/remote-platform-user/dist /usr/share/nginx/platformuser
COPY --from=build /app/packages/remote-mobile/dist       /usr/share/nginx/mobile

# Build stage runs as root so dist files come over as 750/640. nginx runs
# as the unprivileged nginx user and cannot read them — relax to world-readable.
RUN chmod -R a+rX /usr/share/nginx/host /usr/share/nginx/buyer \
                  /usr/share/nginx/supplier /usr/share/nginx/platformuser \
                  /usr/share/nginx/mobile

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 5015 5016 5017 5018 5019

CMD ["nginx", "-g", "daemon off;"]
