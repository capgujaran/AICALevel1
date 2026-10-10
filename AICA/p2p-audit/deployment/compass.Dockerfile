FROM node:22-alpine
WORKDIR /app
COPY AICA/p2p-audit/site ./site
COPY AICA/p2p-audit/gateway ./gateway
ENV AICA_GATEWAY_MODE=hosted
ENV AICA_CHAT_PORT=8781
EXPOSE 8781
USER node
CMD ["node", "gateway/compass.mjs"]
