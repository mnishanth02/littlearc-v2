FROM clamav/clamav@sha256:e7ead98e7e07231b151bce988e0cfb0a3b46e6e7046d9dd44fd838c0df724a03

COPY infra/railway/staging/clamav/clamd.conf /etc/clamav/clamd.conf
COPY infra/railway/staging/clamav/entrypoint.sh /usr/local/bin/littlearc-clamav

RUN chmod 0755 /usr/local/bin/littlearc-clamav

ENTRYPOINT ["/usr/local/bin/littlearc-clamav"]
