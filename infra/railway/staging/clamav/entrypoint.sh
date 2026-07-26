#!/bin/sh
set -eu

freshclam --stdout
freshclam --daemon --foreground=true --stdout &

exec clamd --foreground
