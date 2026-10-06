FROM node:24.19.0-alpine
WORKDIR /app/discord
COPY discord/package.json discord/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node discord/*.cjs ./
RUN mkdir /app/state && chown node:node /app/state /app/discord
USER node
ENV NODE_ENV=production BOT_DATA_DIR=/app/state BOT_HEALTH_FILE=/tmp/bot-health.json
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD node healthcheck.cjs
CMD ["node", "bot.cjs"]
