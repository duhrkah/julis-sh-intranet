FROM nginx:alpine

# Certbot für Let's Encrypt
RUN apk add --no-cache certbot openssl dcron

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/default.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Cron für automatische Verlängerung (täglich 3:00)
RUN echo "0 3 * * * certbot renew --quiet --webroot -w /var/www/certbot && nginx -s reload 2>/dev/null" | crontab -

EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]
